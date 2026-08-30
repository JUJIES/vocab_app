const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const sharp = require("sharp");
const { SetService } = require("../lib/set-service");
const { VisualService, buildSheetPrompt } = require("../lib/visual-service");

test("sheet prompt fixes six concepts to a calm 3x2 grid without text", () => {
  const prompt = buildSheetPrompt([
    { front: "Hund", back: "dog" },
    { front: "Katze", back: "cat" },
  ]);
  assert.match(prompt, /exact 3-column by 2-row grid/);
  assert.match(prompt, /1\. Hund — dog/);
  assert.match(prompt, /2\. Katze — cat/);
  assert.match(prompt, /Never include letters, words/);
  assert.match(prompt, /6\. empty neutral background/);
});

test("sheet jobs persist reusable assets, attach them, regenerate one and retain history", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "lerndeck-visual-test-"));
  const setService = new SetService({ dataDir });
  const generatedSizes = [];
  const client = {
    images: {
      generate: async ({ size }) => {
        generatedSizes.push(size);
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

  const card = visualizedSet.cards[0];
  const originalAssetId = card.visual.assetId;
  await visualService.startCardRegeneration("julius", createdSet.id, card.id);
  await waitForCompletedJob(visualService, "julius", createdSet.id);
  const regeneratedSet = await setService.getOwnedSet("julius", createdSet.id);
  assert.notEqual(regeneratedSet.cards[0].visual.assetId, originalAssetId);
  const history = (await visualService.listAssets("julius", createdSet.id))
    .filter((asset) => asset.cardId === card.id);
  assert.equal(history.length, 2);
  assert.deepEqual(generatedSizes, ["1536x1024", "1536x1024", "1024x1024"]);

  await visualService.selectAsset("julius", createdSet.id, card.id, originalAssetId);
  const restoredSet = await setService.getOwnedSet("julius", createdSet.id);
  assert.equal(restoredSet.cards[0].visual.assetId, originalAssetId);
});

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
