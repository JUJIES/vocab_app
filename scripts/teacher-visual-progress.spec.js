const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 1024, height: 900 },
  colorScheme: "dark",
  locale: "de-DE",
});

test("an active visual job has one progress display instead of duplicate action buttons", async ({ page }) => {
  const activeJob = {
    id: "job-1",
    setId: "set-1",
    type: "sheet",
    status: "generating",
    totalCards: 2,
    totalSheets: 5,
    completedSheets: 2,
    activeSheet: 3,
    attachedCount: 1,
    skippedCount: 0,
    createdAt: "2026-09-06T18:00:00.000Z",
  };
  const cards = [
    {
      id: "card-1",
      front: "Fähre",
      back: "ferry",
      visual: {
        assetId: "visual-1",
        url: "/media/visuals/visual-1.webp",
        width: 512,
        height: 512,
        alt: "Lernbild zu Fähre",
      },
    },
    { id: "card-2", front: "zu Fuß", back: "on foot" },
  ];
  const set = {
    id: "set-1",
    path: "sets/user/set-1.json",
    status: "published",
    editable: true,
    title: "Means of transport",
    subject: "Englisch",
    description: "Testset",
    sourceLanguage: "de",
    targetLanguage: "en",
    sourceLabel: "Deutsch",
    targetLabel: "Englisch",
    cards,
  };

  await page.route("**/api/runtime-info", (route) => route.fulfill({ json: { publicOrigin: BASE_URL } }));
  await page.route("**/api/teacher/accounts", (route) => route.fulfill({
    json: { accounts: [{ id: "julius", displayName: "Julius" }] },
  }));
  await page.route("**/api/teacher/session", (route) => route.fulfill({
    json: { session: { teacherId: "julius" }, teacher: { id: "julius", displayName: "Julius" } },
  }));
  await page.route("**/api/sets", (route) => route.fulfill({
    json: {
      sets: [{ ...set, cardCount: cards.length, cards: undefined, tablets: [] }],
      teacher: { id: "julius" },
      importConfigured: true,
      visualConfigured: true,
    },
  }));
  await page.route("**/api/tablets", (route) => route.fulfill({ json: { tablets: [] } }));
  await page.route("**/api/teacher/visual-jobs", (route) => route.fulfill({ json: { jobs: [activeJob] } }));
  await page.route("**/api/teacher/sets/set-1/visual-assets", (route) => route.fulfill({
    json: { assets: [], jobs: [activeJob] },
  }));
  await page.route("**/api/teacher/sets/set-1", (route) => route.fulfill({ json: { set } }));

  await page.goto("/teacher", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Set Means of transport bearbeiten" }).click();

  const editor = page.locator("#set-editor-form");
  await expect(editor).toBeVisible();
  await expect(editor.locator("#generate-visuals-button")).toBeHidden();
  await expect(editor.locator("#regenerate-all-visuals-button")).toBeHidden();
  await expect(editor.locator("#visual-job-status")).toHaveText("Sheet 3/5 · Du kannst weiterarbeiten.");
  await expect(editor.getByText("Sheet 3/5", { exact: true })).toHaveCount(0);
});
