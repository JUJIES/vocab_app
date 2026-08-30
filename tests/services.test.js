const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { ImportService, parseStructuredText } = require("../lib/import-service");
const { RuntimeJsonStore } = require("../lib/runtime-json-store");
const { SetService } = require("../lib/set-service");
const { TeacherService } = require("../lib/teacher-service");

async function withTempDirectory(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "lerndeck-test-"));
  try {
    return await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test("RuntimeJsonStore serializes concurrent mutations", async () => {
  await withTempDirectory(async (directory) => {
    const store = new RuntimeJsonStore(path.join(directory, "counter.json"), {
      defaultValue: { count: 0 },
    });
    await Promise.all(Array.from({ length: 20 }, () => store.mutate((value) => {
      value.count += 1;
    })));
    assert.deepEqual(await store.read(), { count: 20 });
  });
});

test("teacher start passwords are provisioned once and can be changed", async () => {
  await withTempDirectory(async (directory) => {
    const seedPath = path.join(directory, "teachers.seed.json");
    await fs.writeFile(seedPath, JSON.stringify({
      version: 1,
      teachers: [{ id: "julius", username: "julius", displayName: "Julius" }],
    }));
    const service = new TeacherService({ dataDir: directory, seedPath });
    const [provisioned] = await service.provisionInitialPasswords();
    assert.equal(provisioned.id, "julius");
    assert.match(provisioned.initialPassword, /^LERN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.deepEqual(await service.provisionInitialPasswords(), []);

    const teacher = await service.authenticate({
      teacherId: "julius",
      password: provisioned.initialPassword,
    });
    assert.equal(teacher.status, "active");
    assert.equal(teacher.mustChangePassword, true);
    await assert.rejects(
      () => service.changePassword({
        teacherId: "julius",
        currentPassword: "falsches-passwort",
        newPassword: "anderes-passwort",
      }),
      { code: "INVALID_CURRENT_PASSWORD" },
    );

    const session = service.createSession("julius");
    const restartedService = new TeacherService({ dataDir: directory, seedPath });
    assert.equal(restartedService.requireSession(session.token).teacherId, "julius");

    const changed = await restartedService.changePassword({
      teacherId: "julius",
      currentPassword: provisioned.initialPassword,
      newPassword: "sicheres-passwort",
    });
    assert.equal(changed.mustChangePassword, false);
    await assert.rejects(
      () => restartedService.authenticate({
        teacherId: "julius",
        password: provisioned.initialPassword,
      }),
      { code: "INVALID_CREDENTIALS" },
    );
    assert.equal((await restartedService.authenticate({
      teacherId: "julius",
      password: "sicheres-passwort",
    })).id, "julius");
    assert.equal(restartedService.deleteSessionsForTeacher("julius"), 1);
    assert.equal(restartedService.requireSession(session.token).ok, false);

    const sessionBeforeReset = restartedService.createSession("julius");
    const reset = await restartedService.resetPassword("julius");
    assert.match(reset.initialPassword, /^LERN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.equal(restartedService.requireSession(sessionBeforeReset.token).ok, false);
    assert.equal((await restartedService.authenticate({
      teacherId: "julius",
      password: reset.initialPassword,
    })).mustChangePassword, true);
    await assert.rejects(
      () => restartedService.authenticate({
        teacherId: "julius",
        password: "sicheres-passwort",
      }),
      { code: "INVALID_CREDENTIALS" },
    );
  });
});

test("private sets keep their path and share code while revisions update", async () => {
  await withTempDirectory(async (directory) => {
    const service = new SetService({ dataDir: directory });
    const created = await service.createSet("julius", {
      title: "Tiere",
      cards: [
        { front: "Hund", back: "dog", acceptedAnswers: ["dog"] },
        { front: "Katze", back: "cat", acceptedAnswers: ["cat"] },
      ],
    });
    assert.match(created.shareCode, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.match(created.path, /^sets\/user\/[a-f0-9-]{36}\.json$/);

    const firstCardId = created.cards[0].id;
    const secondCardId = created.cards[1].id;
    const updated = await service.updateSet("julius", created.id, {
      title: "Tiere neu",
      cards: [
        { ...created.cards[0] },
        { ...created.cards[1], back: "a cat", acceptedAnswers: ["a cat"] },
      ],
    });
    assert.equal(updated.path, created.path);
    assert.equal(updated.shareCode, created.shareCode);
    assert.equal(updated.cards[0].id, firstCardId);
    assert.notEqual(updated.cards[1].id, secondCardId);

    const publicEntry = await service.resolveShareCode(created.shareCode);
    assert.equal(publicEntry.path, created.path);
    const document = service.toSetDocument(await service.findPublishedSetById(created.id));
    assert.equal(document.cards[0].hintData.flashcard.exampleId, "answer");
    assert.equal(document.cards[0].examples[0].target, "dog");
  });
});

test("teacher sets stay private while public codes remain resolvable", async () => {
  await withTempDirectory(async (directory) => {
    const service = new SetService({ dataDir: directory });
    const juliusSet = await service.createSet("julius", {
      title: "Privat",
      cards: [{ front: "A", back: "B" }],
    });
    assert.equal((await service.listOwnedSets("julius")).length, 1);
    assert.equal((await service.listOwnedSets("jessi-s")).length, 0);
    assert.equal((await service.resolveShareCode(juliusSet.shareCode)).title, "Privat");
  });
});

test("legacy sets migrate once into Julius' private sets without changing learning paths", async () => {
  await withTempDirectory(async (directory) => {
    const service = new SetService({ dataDir: directory });
    const seed = {
      id: "food-basics-01",
      path: "sets/food-basics-01.json",
      title: "Food Basics",
      sourceLanguage: "de",
      targetLanguage: "en",
      sourceLabel: "Deutsch",
      targetLabel: "Englisch",
      cards: [{
        id: "c001",
        front: "Zutat",
        back: "ingredient",
        acceptedAnswers: ["ingredient"],
        presentation: {
          examples: [{ id: "ex1", source: "Eine Zutat", target: "An ingredient" }],
          audio: { target: "audio/food-basics-01/c001-target.mp3" },
        },
      }],
    };

    const firstMigration = await service.ensureOwnedSeedSets("julius", [seed]);
    const [migratedSummary] = await service.listOwnedSets("julius");
    const migrated = await service.getOwnedSet("julius", seed.id);
    assert.deepEqual(firstMigration, { added: 1, total: 1 });
    assert.equal(migratedSummary.path, seed.path);
    assert.equal(migrated.cards[0].id, "c001");
    assert.match(migratedSummary.shareCode, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal((await service.listOwnedSets("jessi-s")).length, 0);

    const document = service.toSetDocument(await service.findPublishedSetByPath(seed.path));
    assert.equal(document.cards[0].examples[0].id, "ex1");
    assert.equal(document.cards[0].audio.target, "audio/food-basics-01/c001-target.mp3");

    await service.updateSet("julius", seed.id, {
      title: "Food Basics – Julius",
      sourceLanguage: "de",
      targetLanguage: "en",
      sourceLabel: "Deutsch",
      targetLabel: "Englisch",
      cards: migrated.cards,
    });
    const secondMigration = await service.ensureOwnedSeedSets("julius", [seed]);
    const [afterRestart] = await service.listOwnedSets("julius");
    assert.deepEqual(secondMigration, { added: 0, total: 1 });
    assert.equal(afterRestart.title, "Food Basics – Julius");
    assert.equal(afterRestart.path, seed.path);
  });
});

test("clear two-column text imports without an AI request", () => {
  const draft = parseStructuredText("Hund; dog\nKatze; cat\nVogel; bird");
  assert.equal(draft.title, "Neues Lernset");
  assert.deepEqual(draft.cards.map(({ front, back }) => ({ front, back })), [
    { front: "Hund", back: "dog" },
    { front: "Katze", back: "cat" },
    { front: "Vogel", back: "bird" },
  ]);
});

test("a new set enriches even a clear two-column list with AI metadata", async () => {
  let request;
  const service = new ImportService({
    client: {
      responses: {
        create: async (value) => {
          request = value;
          return {
            model: "gpt-5.6-terra",
            output_text: JSON.stringify({
              title: "Tiere auf Englisch",
              subject: "Englisch",
              description: "Grundwortschatz zu Haustieren und Vögeln",
              sourceLanguage: "de",
              targetLanguage: "en",
              sourceLabel: "Deutsch",
              targetLabel: "Englisch",
              cards: [
                { front: "Hund", back: "dog", acceptedAnswers: ["dog"] },
              ],
            }),
          };
        },
      },
    },
  });

  const result = await service.createDraft({
    teacherId: "julius",
    text: "Hund; dog\nKatze; cat",
    instruction: "",
    files: [],
    purpose: "create_set",
  });

  assert.equal(result.importMethod, "openai");
  assert.deepEqual(
    {
      title: result.draft.title,
      subject: result.draft.subject,
      description: result.draft.description,
      sourceLanguage: result.draft.sourceLanguage,
      targetLanguage: result.draft.targetLanguage,
      sourceLabel: result.draft.sourceLabel,
      targetLabel: result.draft.targetLabel,
    },
    {
      title: "Tiere auf Englisch",
      subject: "Englisch",
      description: "Grundwortschatz zu Haustieren und Vögeln",
      sourceLanguage: "de",
      targetLanguage: "en",
      sourceLabel: "Deutsch",
      targetLabel: "Englisch",
    },
  );
  assert.match(request.input[0].content[0].text, /passende Set-Metadaten/);
  assert.match(request.input[0].content[0].text, /Vermeide generische Titel/);
  assert.deepEqual(result.draft.cards.map(({ front, back }) => ({ front, back })), [
    { front: "Hund", back: "dog" },
    { front: "Katze", back: "cat" },
  ]);
});

test("a new clear list still works with neutral metadata when AI is unavailable", async () => {
  const service = new ImportService({ apiKey: "" });
  const result = await service.createDraft({
    teacherId: "julius",
    text: "Hund; dog\nKatze; cat",
    instruction: "",
    files: [],
    purpose: "create_set",
  });

  assert.equal(result.importMethod, "structured_text");
  assert.equal(result.draft.title, "Neues Lernset");
  assert.equal(result.draft.cards.length, 2);
});

test("appending a clear list remains deterministic and does not require AI", async () => {
  let aiRequests = 0;
  const service = new ImportService({
    client: {
      responses: {
        create: async () => {
          aiRequests += 1;
          throw new Error("AI should not be called");
        },
      },
    },
  });

  const result = await service.createDraft({
    teacherId: "julius",
    text: "Hund; dog\nKatze; cat",
    instruction: "",
    files: [],
    purpose: "append_cards",
  });

  assert.equal(result.importMethod, "structured_text");
  assert.equal(aiRequests, 0);
});

test("an import instruction deliberately routes a clear list through AI", async () => {
  let request;
  const service = new ImportService({
    client: {
      responses: {
        create: async (value) => {
          request = value;
          return {
            model: "gpt-5.6-terra",
            output_text: JSON.stringify({
              title: "Lektion 1",
              subject: "Englisch",
              description: "",
              sourceLanguage: "de",
              targetLanguage: "en",
              sourceLabel: "Deutsch",
              targetLabel: "Englisch",
              cards: [{ front: "Hund", back: "dog", acceptedAnswers: ["dog"] }],
            }),
          };
        },
      },
    },
  });

  const result = await service.createDraft({
    teacherId: "julius",
    text: "Hund; dog\nKatze; cat",
    instruction: "Nur Lektion 1, Deutsch → Englisch. Nimm nur Hund.",
    files: [],
  });

  assert.equal(result.importMethod, "openai");
  assert.deepEqual(result.draft.cards.map(({ front, back }) => ({ front, back })), [
    { front: "Hund", back: "dog" },
  ]);
  const prompt = request.input[0].content[0].text;
  assert.match(prompt, /<arbeitsauftrag_der_lehrkraft>/);
  assert.match(prompt, /Nur Lektion 1, Deutsch → Englisch/);
  assert.match(prompt, /<eingefuegtes_material>/);
  assert.match(prompt, /Hund; dog/);
  assert.match(prompt, /Alle ausgewählten Begriffe oder Wendungen müssen im Material vorkommen/);
  assert.match(prompt, /darfst du diese knapp und fachlich korrekt ergänzen/);
  assert.match(prompt, /Lautschrift, Grammatikcodes, Lernstufen/);
});

test("image, DOCX and PDF inputs use the expected Responses API content types", async () => {
  let request;
  const service = new ImportService({
    client: {
      responses: {
        create: async (value) => {
          request = value;
          return {
            output_text: JSON.stringify({
              title: "Fachbegriffe",
              subject: "Biologie",
              description: "",
              sourceLanguage: "de",
              targetLanguage: "de",
              sourceLabel: "Begriff",
              targetLabel: "Definition",
              cards: [{ front: "Fotosynthese", back: "Aufbau von Glucose mithilfe von Lichtenergie", acceptedAnswers: ["Aufbau von Glucose mithilfe von Lichtenergie"] }],
            }),
          };
        },
      },
    },
  });

  await service.createDraft({
    teacherId: "julius",
    text: "",
    instruction: "Die wichtigsten Begriffe mit kurzen deutschen Definitionen.",
    files: [
      { name: "seite.png", type: "image/png", data: Buffer.from("png-fixture").toString("base64") },
      {
        name: "liste.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        data: Buffer.from("docx-fixture").toString("base64"),
      },
      { name: "kapitel.pdf", type: "application/pdf", data: Buffer.from("pdf-fixture").toString("base64") },
    ],
  });

  const [, image, docx, pdf] = request.input[0].content;
  assert.deepEqual(
    { type: image.type, detail: image.detail, prefix: image.image_url.slice(0, 22) },
    { type: "input_image", detail: "original", prefix: "data:image/png;base64," },
  );
  assert.equal(docx.type, "input_file");
  assert.equal(docx.filename, "liste.docx");
  assert.match(docx.file_data, /^data:application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document;base64,/);
  assert.equal(pdf.type, "input_file");
  assert.equal(pdf.detail, "high");
  assert.match(pdf.file_data, /^data:application\/pdf;base64,/);
});

test("provider errors never expose API-key details to the client", async () => {
  const service = new ImportService({
    client: {
      responses: {
        create: async () => {
          const error = new Error("Incorrect API key provider-secret-fragment");
          error.status = 401;
          throw error;
        },
      },
    },
  });
  await assert.rejects(
    () => service.createDraft({
      teacherId: "julius",
      text: "Photosynthese wandelt Lichtenergie in chemische Energie um.",
      files: [],
    }),
    (error) => (
      error.code === "OPENAI_AUTH_FAILED"
      && !error.message.includes("provider-secret-fragment")
      && error.status === 503
    ),
  );
});
