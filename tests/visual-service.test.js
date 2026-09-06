const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const sharp = require("sharp");
const { SetService } = require("../lib/set-service");
const {
  VisualService,
  buildSheetPrompt,
  buildSinglePrompt,
  buildVisualPlanningPrompt,
  normalizeGeneratedTile,
  normalizeGeneratedSheetTile,
} = require("../lib/visual-service");

test("sheet prompt fixes six concepts to a calm 3x2 grid without text", () => {
  const prompt = buildSheetPrompt([
    plannedCard("card_1", "Hund", "dog", "A friendly dog standing in a garden"),
    plannedCard("card_2", "Katze", "cat", "A cat sitting beside a food bowl"),
  ]);
  assert.match(prompt, /exact 3-column by 2-row grid/);
  assert.match(prompt, /1\. Vocabulary pair: Hund — dog/);
  assert.match(prompt, /2\. Vocabulary pair: Katze — cat/);
  assert.match(prompt, /letters, words/);
  assert.match(prompt, /Never include white margins/);
  assert.match(prompt, /never place a smaller rectangular picture inside a dark matte/);
  assert.match(prompt, /Intended meaning/);
  assert.match(prompt, /Avoid/);
  assert.match(prompt, /6\. empty neutral background/);
});

test("single prompt applies an optional visual direction without weakening shared rules", () => {
  const prompt = buildSinglePrompt({
    id: "card_bus",
    front: "Bus",
    back: "bus",
    instruction: "Ein roter Doppeldeckerbus von der Seite",
    visualBrief: createBrief("card_bus", "A public road vehicle", "A red city bus at a bus stop"),
  });

  assert.match(prompt, /red|roter/i);
  assert.match(prompt, /cannot override/);
  assert.match(prompt, /No white margins/);
  assert.match(prompt, /never place a smaller rectangular picture inside a dark matte/);
});

test("semantic planning explicitly protects convenient from the comfortable sense", () => {
  const prompt = buildVisualPlanningPrompt([{
    id: "card_convenient",
    front: "praktisch; bequem",
    back: "convenient",
    instruction: "",
  }], {
    title: "Means of transport",
    subject: "Englisch",
    sourceLanguage: "de",
    targetLanguage: "en",
    sourceLabel: "Deutsch",
    targetLabel: "Englisch",
  });

  assert.match(prompt, /German-speaking secondary-school students/);
  assert.match(prompt, /convenient = useful\/easy for the situation/);
  assert.match(prompt, /never physical comfort such as a sofa/);
  assert.match(prompt, /Do not translate one side in isolation/);
  assert.match(prompt, /Means of transport/);
});

test("generated tile normalization removes a light outer frame and keeps a square output", async () => {
  const framedImage = await sharp({
    create: {
      width: 120,
      height: 120,
      channels: 3,
      background: { r: 250, g: 250, b: 248 },
    },
  }).composite([{
    input: await sharp({
      create: {
        width: 90,
        height: 90,
        channels: 3,
        background: { r: 38, g: 55, b: 78 },
      },
    }).png().toBuffer(),
    left: 15,
    top: 15,
  }]).png().toBuffer();

  const normalized = await normalizeGeneratedTile(framedImage);
  const { data, info } = await sharp(normalized).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 512);
  assert.equal(info.height, 512);
  assert.ok(data[0] < 100, "the white outer frame should not remain in the top-left corner");
});

test("generated tile normalization removes an unmistakable dark rectangular matte", async () => {
  const framedImage = await sharp({
    create: {
      width: 120,
      height: 120,
      channels: 3,
      background: { r: 10, g: 20, b: 34 },
    },
  }).composite([{
    input: await sharp({
      create: {
        width: 96,
        height: 96,
        channels: 3,
        background: { r: 170, g: 125, b: 80 },
      },
    }).png().toBuffer(),
    left: 12,
    top: 12,
  }]).png().toBuffer();

  const normalized = await normalizeGeneratedTile(framedImage);
  const { data, info } = await sharp(normalized).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 512);
  assert.equal(info.height, 512);
  assert.ok(data[0] > 120, "the dark technical matte should not remain in the corner");
});

test("generated tile normalization preserves a genuine dark scene background", async () => {
  const sceneImage = await sharp({
    create: {
      width: 120,
      height: 120,
      channels: 3,
      background: { r: 10, g: 20, b: 34 },
    },
  }).composite([{
    input: await sharp({
      create: {
        width: 42,
        height: 58,
        channels: 3,
        background: { r: 220, g: 145, b: 70 },
      },
    }).png().toBuffer(),
    left: 39,
    top: 38,
  }]).png().toBuffer();

  const normalized = await normalizeGeneratedTile(sceneImage);
  const { data, info } = await sharp(normalized).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 512);
  assert.equal(info.height, 512);
  assert.ok(data[0] < 40, "the intended dark scene background should remain visible");
});

test("sheet tile normalization removes the fixed grid safety inset", async () => {
  const interior = await sharp({
    create: {
      width: 506,
      height: 506,
      channels: 3,
      background: { r: 35, g: 180, b: 90 },
    },
  }).png().toBuffer();
  const composites = [];
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      composites.push({
        input: interior,
        left: (column * 512) + 3,
        top: (row * 512) + 3,
      });
    }
  }
  const sheet = await sharp({
    create: {
      width: 1536,
      height: 1024,
      channels: 3,
      background: { r: 245, g: 35, b: 45 },
    },
  }).composite(composites).webp({ quality: 90 }).toBuffer();

  const normalized = await normalizeGeneratedSheetTile(sheet, { column: 1, row: 1 });
  const { data, info } = await sharp(normalized).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 512);
  assert.equal(info.height, 512);
  assert.ok(data[0] < 80 && data[1] > 130, "the red sheet divider must not remain at the tile edge");
});

test("active legacy sheet assets are safely derived once without image generation", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "lerndeck-visual-normalize-test-"));
  const setService = new SetService({ dataDir });
  let imageGenerationCount = 0;
  const client = {
    responses: {
      create: async ({ input }) => {
        const prompt = input[0].content[0].text;
        const cardJson = prompt.split("Vocabulary cards: ")[1].split("\nReturn exactly")[0];
        const cards = JSON.parse(cardJson);
        return {
          output_text: JSON.stringify({
            briefs: cards.map((card) => createBrief(card.cardId, card.back, `Scene for ${card.back}`)),
          }),
        };
      },
    },
    images: {
      generate: async () => {
        imageGenerationCount += 1;
        const image = await sharp({
          create: {
            width: 1536,
            height: 1024,
            channels: 3,
            background: { r: 38, g: 55, b: 78 },
          },
        }).webp().toBuffer();
        return { data: [{ b64_json: image.toString("base64") }] };
      },
    },
  };
  const visualService = new VisualService({ dataDir, setService, client });
  const createdSet = await setService.createSet("julius", {
    title: "Legacy sheet normalization",
    cards: [{ front: "Feld", back: "field" }],
  });
  await visualService.startMissingVisuals("julius", createdSet.id);
  await waitForCompletedJob(visualService, "julius", createdSet.id);

  const [originalAsset] = await visualService.listAssets("julius", createdSet.id);
  await visualService.assetStore.mutate((store) => {
    store.assets.find((asset) => asset.id === originalAsset.id).normalizationVersion = "";
  });
  const framedTile = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 3,
      background: { r: 245, g: 35, b: 45 },
    },
  }).composite([{
    input: await sharp({
      create: {
        width: 506,
        height: 506,
        channels: 3,
        background: { r: 35, g: 180, b: 90 },
      },
    }).png().toBuffer(),
    left: 3,
    top: 3,
  }]).webp({ quality: 90 }).toBuffer();
  await fs.writeFile(visualService.getAssetPath(originalAsset.id), framedTile);

  const dryRun = await visualService.normalizeActiveSheetAssets("julius", createdSet.id);
  assert.equal(dryRun.candidateCount, 1);
  assert.equal(dryRun.appliedCount, 0);
  const applied = await visualService.normalizeActiveSheetAssets("julius", createdSet.id, { apply: true });
  assert.equal(applied.appliedCount, 1);
  assert.equal(imageGenerationCount, 1, "post-processing must not trigger another image request");

  const normalizedSet = await setService.getOwnedSet("julius", createdSet.id);
  const derivedAssetId = normalizedSet.cards[0].visual.assetId;
  assert.notEqual(derivedAssetId, originalAsset.id);
  const [derivedAsset] = await visualService.listAssets("julius", createdSet.id);
  assert.equal(derivedAsset.parentAssetId, originalAsset.id);
  assert.equal(derivedAsset.normalizationVersion, "sheet-safe-inset-v1");
  const { data, info } = await sharp(await fs.readFile(visualService.getAssetPath(derivedAssetId)))
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 512);
  assert.equal(info.height, 512);
  assert.ok(data[0] < 80 && data[1] > 130, "the derived asset must no longer expose the border");

  const repeated = await visualService.normalizeActiveSheetAssets("julius", createdSet.id, { apply: true });
  assert.equal(repeated.candidateCount, 0);
  assert.equal(repeated.alreadyNormalizedCount, 1);
  assert.equal((await visualService.listAssets("julius", createdSet.id)).length, 2);
});

test("sheet jobs persist reusable assets, attach them, regenerate one and retain history", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "lerndeck-visual-test-"));
  const setService = new SetService({ dataDir });
  const generatedSizes = [];
  const generatedPrompts = [];
  const planningPrompts = [];
  const client = {
    responses: {
      create: async ({ input }) => {
        const prompt = input[0].content[0].text;
        planningPrompts.push(prompt);
        const cardJson = prompt.split("Vocabulary cards: ")[1].split("\nReturn exactly")[0];
        const cards = JSON.parse(cardJson);
        return {
          model: "fake-planner",
          output_text: JSON.stringify({
            briefs: cards.map((card) => createBrief(
              card.cardId,
              `Exact meaning of ${card.back}`,
              `A concrete classroom-safe scene for ${card.back}`,
            )),
          }),
        };
      },
    },
    images: {
      generate: async ({ size, prompt }) => {
        generatedSizes.push(size);
        generatedPrompts.push(prompt);
        const [width, height] = size.split("x").map(Number);
        const image = await sharp({
          create: {
            width,
            height,
            channels: 3,
            background: { r: 38, g: 55, b: 78 },
          },
        }).webp().toBuffer();
        return { data: [{ b64_json: image.toString("base64") }] };
      },
    },
  };
  const visualService = new VisualService({ dataDir, setService, client });
  const createdSet = await setService.createSet("julius", {
    title: "Visual test",
    sourceLabel: "Deutsch",
    targetLabel: "Englisch",
    cards: Array.from({ length: 7 }, (_, index) => ({
      front: `Begriff ${index + 1}`,
      back: `term ${index + 1}`,
    })),
  });

  await visualService.startMissingVisuals("julius", createdSet.id);
  await waitForCompletedJob(visualService, "julius", createdSet.id);
  const visualizedSet = await setService.getOwnedSet("julius", createdSet.id);
  assert.equal(visualizedSet.cards.filter((card) => card.visual?.url).length, 7);
  assert.deepEqual(generatedSizes, ["1536x1024", "1536x1024"]);
  assert.equal((await visualService.listAssets("julius", createdSet.id)).length, 7);
  const firstSheetAsset = (await visualService.listAssets("julius", createdSet.id))
    .find((asset) => asset.cardId === visualizedSet.cards[0].id);
  assert.equal(firstSheetAsset.sheetNumber, 1);
  assert.equal(firstSheetAsset.sheetIndex, 0);
  assert.equal(firstSheetAsset.normalizationVersion, "sheet-safe-inset-v1");
  assert.equal(planningPrompts.length, 2);
  assert.match(generatedPrompts[0], /Exact meaning of term 1/);
  assert.match(generatedPrompts[0], /A concrete classroom-safe scene for term 1/);

  const originalAssetIds = visualizedSet.cards.map((entry) => entry.visual.assetId);
  await visualService.startAllVisualRegeneration("julius", createdSet.id);
  await waitForCompletedJob(visualService, "julius", createdSet.id);
  const fullyRegeneratedSet = await setService.getOwnedSet("julius", createdSet.id);
  assert.ok(fullyRegeneratedSet.cards.every((entry, index) => entry.visual.assetId !== originalAssetIds[index]));
  assert.equal((await visualService.listAssets("julius", createdSet.id)).length, 14);

  const card = fullyRegeneratedSet.cards[0];
  const originalAssetId = card.visual.assetId;
  await visualService.startCardRegeneration(
    "julius",
    createdSet.id,
    card.id,
    "Mit einem gelben Ball im Vordergrund",
  );
  await waitForCompletedJob(visualService, "julius", createdSet.id);
  const regeneratedSet = await setService.getOwnedSet("julius", createdSet.id);
  assert.notEqual(regeneratedSet.cards[0].visual.assetId, originalAssetId);
  const history = (await visualService.listAssets("julius", createdSet.id))
    .filter((asset) => asset.cardId === card.id);
  assert.equal(history.length, 3);
  assert.equal(history[0].instruction, "Mit einem gelben Ball im Vordergrund");
  assert.equal(history[0].visualBrief.intendedMeaning, "Exact meaning of term 1");
  assert.match(generatedPrompts.at(-1), /gelben Ball/);
  assert.deepEqual(generatedSizes, ["1536x1024", "1536x1024", "1536x1024", "1536x1024", "1024x1024"]);
  assert.equal(planningPrompts.length, 5);

  await visualService.selectAsset("julius", createdSet.id, card.id, originalAssetId);
  const restoredSet = await setService.getOwnedSet("julius", createdSet.id);
  assert.equal(restoredSet.cards[0].visual.assetId, originalAssetId);
});

function createBrief(cardId, intendedMeaning, scene) {
  return {
    cardId,
    intendedMeaning,
    scene,
    avoid: ["a neighboring but incorrect meaning"],
    strategy: "contextual",
    confidence: "high",
  };
}

function plannedCard(id, front, back, scene) {
  return {
    id,
    front,
    back,
    visualBrief: createBrief(id, `Exact meaning of ${back}`, scene),
  };
}

async function waitForCompletedJob(service, teacherId, setId) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const [job] = await service.listJobs(teacherId, { setId });
    if (job?.status === "completed") {
      return job;
    }
    if (job?.status === "failed") {
      assert.fail(job.error || "visual job failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  assert.fail("visual job did not complete");
}
