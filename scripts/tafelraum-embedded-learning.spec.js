const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const TAFELRAUM_ORIGIN = process.env.TAFELRAUM_ORIGIN || "http://127.0.0.1:5173";

test.use({
  viewport: { width: 1200, height: 800 },
  colorScheme: "dark",
  locale: "de-DE",
  serviceWorkers: "block",
});

function buildSetDocument() {
  return {
    schemaVersion: "1.2",
    set: {
      id: "set-1",
      title: "Means of transport",
      subject: "Englisch",
      description: "Tafelraum compositor test",
      languages: { source: "de", target: "en" },
      labels: { source: "Deutsch", target: "Englisch" },
      defaultDirections: { flashcard: "source_to_target", test: "source_to_target" },
    },
    cards: Array.from({ length: 6 }, (_, index) => ({
      id: `card-${index + 1}`,
      source: { text: `Wort ${index + 1}` },
      target: { text: `answer ${index + 1}` },
      acceptedAnswers: [],
      examples: [{ id: "answer", source: `Wort ${index + 1}`, target: `answer ${index + 1}` }],
      hintData: {
        flashcard: { exampleId: "answer", maskedWord: "______", firstLetterHint: "a_____" },
      },
    })),
  };
}

async function installApiFixtures(page) {
  const setDocument = buildSetDocument();
  const set = {
    id: "set-1",
    path: "sets/user/set-1.json",
    status: "published",
    title: setDocument.set.title,
    subject: setDocument.set.subject,
    description: setDocument.set.description,
    sourceLanguage: "de",
    targetLanguage: "en",
    sourceLabel: "Deutsch",
    targetLabel: "Englisch",
    cardCount: setDocument.cards.length,
    cards: setDocument.cards,
    tablets: [],
  };

  await page.route("**/api/runtime-info", (route) => route.fulfill({
    json: { publicOrigin: BASE_URL },
  }));
  await page.route("**/api/teacher/session", (route) => route.fulfill({
    json: { session: { teacherId: "julius" }, teacher: { id: "julius", displayName: "Julius" } },
  }));
  await page.route("**/api/teacher/accounts", (route) => route.fulfill({
    json: { accounts: [{ id: "julius", displayName: "Julius" }] },
  }));
  await page.route("**/api/sets", (route) => route.fulfill({
    json: {
      sets: [{ ...set, cards: undefined }],
      teacher: { id: "julius" },
      importConfigured: true,
      visualConfigured: true,
    },
  }));
  await page.route("**/api/tablets", (route) => route.fulfill({ json: { tablets: [] } }));
  await page.route("**/api/teacher/visual-jobs", (route) => route.fulfill({ json: { jobs: [] } }));
  await page.route("**/api/teacher/sets/set-1", (route) => route.fulfill({ json: { set } }));
  await page.route("**/sets/user/set-1.json*", (route) => route.fulfill({ json: setDocument }));
}

async function openScaledFrame(page, path, { expectEmbedMarker = true } = {}) {
  // Keep the parent document on an origin explicitly admitted by Lerndeck's
  // frame-ancestors policy, just like the real Tafelraum canvas.
  await page.goto(TAFELRAUM_ORIGIN, { waitUntil: "domcontentloaded" });
  await page.setContent(`
    <style>
      body { margin: 0; background: #1b222c; }
      #clip {
        width: 970px;
        height: 484px;
        overflow: hidden;
      }
      iframe {
        width: 1652px;
        height: 824px;
        border: 0;
        transform: scale(0.587);
        transform-origin: top left;
      }
    </style>
    <div id="clip"><iframe title="Lerndeck" src="${new URL(path, BASE_URL)}"></iframe></div>
  `);
  const frame = page.frameLocator('iframe[title="Lerndeck"]');
  if (expectEmbedMarker) {
    await expect(frame.locator("html")).toHaveAttribute("data-tafelraum-embed", "true");
  }
  return frame;
}

async function startMode(frame, modeKey) {
  await expect(frame.locator("#launch-mode-modal")).toBeVisible();
  await frame.locator(`.launch-mode-modal__mode-card[data-mode-key="${modeKey}"]`).click();
  await frame.locator("#launch-mode-start").click();
  await expect(frame.locator("#launch-settings-modal")).toBeVisible();
  await frame.locator(
    '[data-learning-direction-group="launch"] [data-learning-direction="source-target"]',
  ).click();
  await frame.locator("#launch-settings-start").click();
}

test("embedded practice keeps its card size and scrolls when the frame becomes shorter", async ({ page }, testInfo) => {
  await installApiFixtures(page);

  let frame = await openScaledFrame(page, "/teacher?embed=tafelraum", { expectEmbedMarker: false });
  await expect(frame.locator(".teacher-set-row").first()).toBeVisible();

  frame = await openScaledFrame(
    page,
    "/index.html?teacherPractice=set-1&embed=tafelraum",
  );
  await startMode(frame, "practice");
  await expect(frame.locator("#flashcard")).toBeVisible();
  await expect(frame.locator(".flashcard__inner")).toHaveCSS("transform-style", "preserve-3d");
  const fullHeight = await frame.locator("#flashcard").evaluate((card) => ({
    cardWidth: card.getBoundingClientRect().width,
    innerHeight: window.innerHeight,
  }));

  await page.locator('iframe[title="Lerndeck"]').evaluate((iframe) => {
    iframe.style.transform = "translateY(-180px) scale(0.587)";
  });
  const moved = await frame.locator("#flashcard").evaluate((card) => ({
    cardWidth: card.getBoundingClientRect().width,
    innerHeight: window.innerHeight,
  }));
  expect(moved).toEqual(fullHeight);

  await page.locator('iframe[title="Lerndeck"]').evaluate((iframe) => {
    iframe.style.height = "520px";
    iframe.style.transform = "scale(0.587)";
  });
  const shortHeight = await frame.locator("#flashcard").evaluate((card) => ({
    cardWidth: card.getBoundingClientRect().width,
    innerHeight: window.innerHeight,
    scrollHeight: document.scrollingElement.scrollHeight,
  }));
  expect(Math.abs(shortHeight.cardWidth - fullHeight.cardWidth)).toBeLessThan(1);
  expect(shortHeight.innerHeight).toBe(520);
  expect(shortHeight.scrollHeight).toBeGreaterThan(shortHeight.innerHeight);
  await page.screenshot({ path: testInfo.outputPath("tafelraum-practice-short-scroll.png") });

  frame = await openScaledFrame(page, "/index.html?teacherPractice=set-1&embed=tafelraum");
  await startMode(frame, "write");
  await expect(frame.locator("#input-stage")).toBeVisible();

  frame = await openScaledFrame(page, "/index.html?teacherPractice=set-1&embed=tafelraum");
  await startMode(frame, "test");
  await expect(frame.locator("#test-stage")).toBeVisible();
});

test("the regular Lerndeck practice card keeps its 3D presentation", async ({ page }) => {
  await installApiFixtures(page);
  await page.goto(`${BASE_URL}/index.html?teacherPractice=set-1`, { waitUntil: "networkidle" });
  await expect(page.locator("html")).not.toHaveAttribute("data-tafelraum-embed", "true");
  await startMode(page, "practice");
  await expect(page.locator("#flashcard")).toBeVisible();
  await expect(page.locator(".flashcard__inner")).toHaveCSS("transform-style", "preserve-3d");
});
