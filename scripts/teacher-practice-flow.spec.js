const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 1024, height: 768 },
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
      description: "Important words from the lessons",
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
      hintData: { flashcard: { exampleId: "answer", maskedWord: "______", firstLetterHint: "a_____" } },
    })),
  };
}

test("teacher opens shared learning modes without writing tablet progress", async ({ page: teacherPage, context }, testInfo) => {
  const setDocument = buildSetDocument();
  const editableSet = {
    id: "set-1",
    path: "sets/user/set-1.json",
    status: "published",
    editable: true,
    title: setDocument.set.title,
    subject: setDocument.set.subject,
    description: setDocument.set.description,
    sourceLanguage: "de",
    targetLanguage: "en",
    sourceLabel: "Deutsch",
    targetLabel: "Englisch",
    cardCount: setDocument.cards.length,
    cards: setDocument.cards.map(card => ({ id: card.id, front: card.source.text, back: card.target.text, acceptedAnswers: card.acceptedAnswers })),
    tablets: [],
  };
  let tabletProgressWrites = 0;

  await context.route("**/api/runtime-info", (route) => route.fulfill({ json: { publicOrigin: BASE_URL } }));
  await context.route("**/api/teacher/accounts", (route) => route.fulfill({
    json: { accounts: [{ id: "julius", displayName: "Julius" }] },
  }));
  await context.route("**/api/teacher/session", (route) => route.fulfill({
    json: { session: { teacherId: "julius" }, teacher: { id: "julius", displayName: "Julius" } },
  }));
  await context.route("**/api/sets", (route) => route.fulfill({
    json: {
      sets: [{ ...editableSet, cards: undefined }],
      teacher: { id: "julius" },
      importConfigured: true,
      visualConfigured: true,
    },
  }));
  await context.route("**/api/tablets", (route) => route.fulfill({ json: { tablets: [] } }));
  await context.route("**/api/teacher/visual-jobs", (route) => route.fulfill({ json: { jobs: [] } }));
  await context.route("**/api/teacher/sets/set-1", (route) => route.fulfill({ json: { set: editableSet } }));
  await context.route("**/sets/user/set-1.json*", (route) => route.fulfill({ json: setDocument }));
  await context.route("**/api/tablets/**/learning-progress/rounds", (route) => {
    tabletProgressWrites += 1;
    return route.fulfill({ status: 500, json: { error: "Teacher practice must not write here" } });
  });

  await context.addInitScript(() => localStorage.setItem("lerndeck-teacher-appearance-v1", JSON.stringify({ mode: "light" })));
  await teacherPage.goto("/teacher", { waitUntil: "networkidle" });
  await teacherPage.evaluate(() => {
    // A stale student binding on a shared browser must never receive teacher preview results.
    window.localStorage.setItem("dino-vocab-device-id-v1", "rot-1");
    window.localStorage.setItem("dino-vocab-session-unlocked-v1", "1");
    window.localStorage.setItem("dino-vocab-tablet-session-v1", JSON.stringify({ tabletId: "rot-1", token: "stale-token" }));
  });
  await teacherPage.getByRole("button", { name: "Set Means of transport öffnen" }).click();
  const practiceButton = teacherPage.getByRole("link", { name: "Lernen", exact: true });
  await expect(practiceButton).toBeVisible();
  await expect(practiceButton.locator("img")).toHaveAttribute("src", "./assets/icons/learning-modes-open.svg");
  await teacherPage.locator("#workspace-editor-actions").screenshot({ path: testInfo.outputPath("teacher-set-practice-icon.png") });
  const newPage = context.waitForEvent("page");
  await practiceButton.click();
  const page = await newPage;

  await expect(page).toHaveURL(/teacherPractice=set-1/);
  await expect(page.locator("html")).toHaveAttribute("data-appearance-mode", "light");
  await expect(page.locator("#launch-mode-modal")).toBeVisible();
  await expect(page.locator("#launch-mode-title")).toHaveText("Means of transport");
  await expect(page.locator(".launch-mode-modal__mode-card")).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath("teacher-mode-selection.png"), fullPage: true });

  await page.locator('.launch-mode-modal__mode-card[data-mode-key="test"]').click();
  await page.locator("#launch-mode-start").click();
  await expect(page.locator("#launch-settings-modal")).toBeVisible();
  await page.locator('[data-learning-direction-group="launch"] [data-learning-direction="source-target"]').click();
  await page.locator("#launch-settings-start").click();
  await expect(page.locator("#test-stage")).toBeVisible();
  await expect(page.locator("#test-menu-logout")).toBeHidden();

  const rows = page.locator("#test-table-body .test-stage__row");
  await expect(rows).toHaveCount(6);
  for (const row of await rows.all()) {
    const prompt = (await row.locator(".test-stage__prompt").textContent()) || "";
    const number = prompt.match(/\d+/)?.[0];
    await row.locator(".test-stage__input").fill(`answer ${number}`);
  }
  await page.locator("#test-submit").click();
  await expect(page.locator("#test-feedback-title")).toHaveText("6/6 richtig");
  await expect(page.locator("#test-feedback-detail")).toHaveText("100 % · ungefähr Note 1");
  expect(tabletProgressWrites).toBe(0);

  const closed = page.waitForEvent("close");
  await page.locator("#test-home-link").click();
  await closed;
  await teacherPage.bringToFront();
  await expect(teacherPage.locator("#set-title-input")).toHaveValue("Means of transport");
});

test("generic sets show readable words instead of flags in direction choices", async ({ page: teacherPage, context }, testInfo) => {
  const setDocument = buildSetDocument();
  setDocument.set.title = "Begriffe";
  setDocument.set.languages = { source: "und", target: "und" };
  setDocument.set.labels = { source: "Begriff", target: "Definition" };
  const editableSet = {
    id: "set-1", path: "sets/user/set-1.json", status: "published", editable: true,
    title: "Begriffe", cardCount: setDocument.cards.length,
    sourceLanguage: "und", targetLanguage: "und", sourceLabel: "Begriff", targetLabel: "Definition",
    cards: setDocument.cards.map(card => ({ id: card.id, front: card.source.text, back: card.target.text, acceptedAnswers: card.acceptedAnswers })), tablets: [],
  };
  await context.route("**/api/runtime-info", (route) => route.fulfill({ json: { publicOrigin: BASE_URL } }));
  await context.route("**/api/teacher/accounts", (route) => route.fulfill({
    json: { accounts: [{ id: "julius", displayName: "Julius" }] },
  }));
  await context.route("**/api/teacher/session", (route) => route.fulfill({
    json: { session: { teacherId: "julius" }, teacher: { id: "julius", displayName: "Julius" } },
  }));
  await context.route("**/api/sets", (route) => route.fulfill({
    json: { sets: [{ ...editableSet, cards: undefined }], teacher: { id: "julius" } },
  }));
  await context.route("**/api/tablets", (route) => route.fulfill({ json: { tablets: [] } }));
  await context.route("**/api/teacher/visual-jobs", (route) => route.fulfill({ json: { jobs: [] } }));
  await context.route("**/api/teacher/sets/set-1", (route) => route.fulfill({ json: { set: editableSet } }));
  await context.route("**/sets/user/set-1.json*", (route) => route.fulfill({ json: setDocument }));

  await teacherPage.goto("/teacher", { waitUntil: "networkidle" });
  await teacherPage.getByRole("button", { name: "Set Begriffe öffnen" }).click();
  const newPage = context.waitForEvent("page");
  await teacherPage.getByRole("link", { name: "Lernen", exact: true }).click();
  const page = await newPage;
  await page.locator('.launch-mode-modal__mode-card[data-mode-key="practice"]').click();
  await page.locator("#launch-mode-start").click();
  const directions = page.locator('[data-learning-direction-group="launch"]');
  await expect(directions).toContainText("Begriff");
  await expect(directions).toContainText("Definition");
  await expect(directions).not.toContainText("🌐");
  await page.setViewportSize({ width: 390, height: 760 });
  await directions.screenshot({ path: testInfo.outputPath("generic-direction-mobile.png") });
  const bounds = await directions.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  for (const choice of await directions.locator(".learning-direction-control__choice").all()) {
    expect(await choice.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
});
