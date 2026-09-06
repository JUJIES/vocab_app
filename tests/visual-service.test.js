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
