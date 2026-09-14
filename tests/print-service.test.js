const test = require("node:test");
const assert = require("node:assert/strict");
const { inflateSync } = require("node:zlib");

const {
  PrintRequestError,
  buildPrintFilename,
  createVocabularyPrintPdf,
} = require("../lib/print-service");

function createSet(cardCount = 12) {
  return {
    id: "test-set",
    title: "Unit 4 – Über Schule sprechen",
    subject: "Englisch",
    sourceLanguage: "en",
    targetLanguage: "de",
    sourceLabel: "Englisch",
    targetLabel: "Deutsch",
    cards: Array.from({ length: cardCount }, (_, index) => ({
      id: `card-${index + 1}`,
      front: index % 7 === 0 ? `a longer vocabulary phrase number ${index + 1}` : `word ${index + 1}`,
      back: `Übersetzung ${index + 1}`,
    })),
  };
}

function extractPageText(pdf) {
  const source = pdf.toString("latin1");
  return [...source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((match) => {
    const page = inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
    return [...page.matchAll(/<([0-9a-f]+)>/gi)]
      .map((glyphs) => Buffer.from(glyphs[1], "hex").toString("latin1"))
      .join("");
  });
}

test("creates vector A4 PDFs for vocabulary tests and lists", async () => {
  const set = createSet(45);
  const cardIds = set.cards.map((card) => card.id);

  for (const kind of ["test", "list"]) {
    const pdf = await createVocabularyPrintPdf({
      set,
      kind,
      direction: "source-target",
      cardIds,
      className: "6a",
    });

    assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.ok(pdf.length > 4_000);
    const pdfSource = pdf.toString("latin1");
    assert.match(pdfSource, /\/BaseFont \/Times/);
    assert.doesNotMatch(pdfSource, /\/BaseFont \/Helvetica/);
    const pageCount = (pdfSource.match(/\/Type \/Page\b/g) || []).length;
    assert.ok(pageCount >= 2 && pageCount <= 3, `unexpected ${kind} page count: ${pageCount}`);
  }
});

test("test backsides continue the numbered rows without repeating student fields or instructions", async () => {
  const set = createSet(25);
  const pdf = await createVocabularyPrintPdf({
    set, kind: "test", direction: "source-target",
    cardIds: set.cards.map((card) => card.id), className: "9b",
  });
  const pages = extractPageText(pdf);
  assert.ok(pages.length >= 2);
  assert.match(pages[0], /Klasse: 9b/);
  assert.match(pages[0], /ARBEITSAUFTRAG/);
  for (const page of pages.slice(1)) {
    assert.match(page, /FORTSETZUNG/);
    assert.match(page, /BEGRIFFANTWORT/);
    assert.doesNotMatch(page, /Klasse:|Name:|Datum:|ARBEITSAUFTRAG/);
  }
});

test("uses the requested card order without persisting a print document", async () => {
  const set = createSet(3);
  const before = structuredClone(set);
  const pdf = await createVocabularyPrintPdf({
    set,
    kind: "test",
    direction: "target-source",
    cardIds: ["card-3", "card-1"],
    className: "",
  });

  assert.equal((pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length, 1);
  assert.deepEqual(set, before);
});

test("accepts a temporary edited test sheet without changing the source set", async () => {
  const set = createSet(2);
  const before = structuredClone(set);
  const pdf = await createVocabularyPrintPdf({
    set, kind: "test", direction: "source-target", cardIds: ["card-2"],
    testDraft: {
      title: "Klassenarbeit", className: "8b", instruction: "Übersetze passend.",
      leftHeading: "Ausgangssprache", rightHeading: "Zielsprache",
      items: [{ id: "card-2", prompt: "Auf dem Blatt geändert" }],
    },
  });
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.deepEqual(set, before);
});

test("rejects empty or overlong temporary column headings", async () => {
  const set = createSet(1);
  for (const leftHeading of [" ", "x".repeat(41), 42]) {
    await assert.rejects(createVocabularyPrintPdf({
      set, kind: "test", direction: "source-target", cardIds: ["card-1"],
      testDraft: {
        title: "Test", className: "", instruction: "",
        leftHeading, rightHeading: "Antwort",
        items: [{ id: "card-1", prompt: "word 1" }],
      },
    }), PrintRequestError);
  }
});

test("rejects forged or empty temporary test prompts", async () => {
  const set = createSet(2);
  for (const items of [
    [{ id: "foreign", prompt: "fremd" }],
    [{ id: "card-1", prompt: "  " }],
    [{ id: "card-1", prompt: "a".repeat(501) }],
  ]) {
    await assert.rejects(createVocabularyPrintPdf({
      set, kind: "test", direction: "source-target", cardIds: ["card-1"],
      testDraft: { title: "Test", className: "", instruction: "", items },
    }), PrintRequestError);
  }
});

test("rejects empty, duplicated, and foreign card selections", async () => {
  const set = createSet(3);
  const requests = [
    [],
    ["card-1", "card-1"],
    ["card-1", "foreign-card"],
  ];

  for (const cardIds of requests) {
    await assert.rejects(
      createVocabularyPrintPdf({ set, kind: "test", direction: "source-target", cardIds }),
      PrintRequestError,
    );
  }
});

test("builds a stable ASCII download filename", () => {
  assert.equal(
    buildPrintFilename("Unit 4 – Über Schule sprechen", "test"),
    "vokabeltest-unit-4-uber-schule-sprechen.pdf",
  );
  assert.equal(buildPrintFilename("", "list"), "vokabelliste-lernset.pdf");
});
