const { test, expect } = require("playwright/test");
const { createVocabularyPrintPdf } = require("../lib/print-service");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 1150, height: 780 },
  colorScheme: "dark",
  locale: "de-DE",
});

function buildEditableSet() {
  return {
    id: "set-1",
    path: "sets/user/set-1.json",
    status: "published",
    editable: true,
    deletable: true,
    title: "Means of transport",
    subject: "Englisch",
    description: "Important words from the lessons",
    sourceLanguage: "en",
    targetLanguage: "de",
    sourceLabel: "Englisch",
    targetLabel: "Deutsch",
    cardCount: 15,
    cards: Array.from({ length: 15 }, (_, index) => ({
      id: `card-${index + 1}`,
      front: `English phrase ${index + 1}`,
      back: `Deutsche Übersetzung ${index + 1}`,
      acceptedAnswers: [],
    })),
    tablets: [],
  };
}

test("teacher creates a temporary list or test PDF from one set", async ({ page }, testInfo) => {
  const editableSet = buildEditableSet();
  const printBodies = [];
  const pdf = await createVocabularyPrintPdf({
    set: editableSet,
    kind: "test",
    direction: "source-target",
    cardIds: editableSet.cards.map((card) => card.id),
    className: "6a",
  });

  await page.route("**/api/runtime-info", (route) => route.fulfill({ json: { publicOrigin: BASE_URL } }));
  await page.route("**/api/teacher/accounts", (route) => route.fulfill({
    json: { accounts: [{ id: "julius", displayName: "Julius" }] },
  }));
  await page.route("**/api/teacher/session", (route) => route.fulfill({
    json: { session: { teacherId: "julius" }, teacher: { id: "julius", displayName: "Julius", role: "admin" } },
  }));
  await page.route("**/api/sets", (route) => route.fulfill({
    json: {
      sets: [{ ...editableSet, cards: undefined }],
      teacher: { id: "julius", role: "admin" },
      importConfigured: true,
      visualConfigured: true,
    },
  }));
  await page.route("**/api/tablets", (route) => route.fulfill({ json: { tablets: [] } }));
  await page.route("**/api/teacher/visual-jobs", (route) => route.fulfill({ json: { jobs: [] } }));
  await page.route("**/api/teacher/sets/set-1/print", async (route) => {
    printBodies.push(JSON.parse(route.request().postData() || "{}"));
    await route.fulfill({ status: 200, contentType: "application/pdf", body: pdf });
  });
  await page.route("**/api/teacher/sets/set-1", (route) => route.fulfill({ json: { set: editableSet } }));

  await page.goto("/teacher", { waitUntil: "networkidle" });
  const printButton = page.getByRole("button", { name: "Set Means of transport ausdrucken" });
  await expect(printButton).toBeVisible();
  await expect(printButton.locator("img")).toHaveAttribute("src", "./assets/icons/print.svg");
  await page.locator(".teacher-set-row").first().screenshot({ path: testInfo.outputPath("set-actions-desktop.png") });
  await page.setViewportSize({ width: 390, height: 780 });
  await page.locator(".teacher-set-row").first().screenshot({ path: testInfo.outputPath("set-actions-mobile.png") });
  await page.setViewportSize({ width: 1150, height: 780 });
  await printButton.click();

  const dialog = page.getByRole("dialog", { name: "Means of transport" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Vokabelliste/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Vokabeltest/ })).toBeVisible();
  await expect(dialog.locator('[data-print-kind="list"] .print-mode-card__icon'))
    .toHaveAttribute("src", "./assets/icons/print-vocabulary-list.png");
  await expect(dialog.locator('[data-print-kind="test"] .print-mode-card__icon'))
    .toHaveAttribute("src", "./assets/icons/print-vocabulary-test.png");
  await expect(dialog.locator(".print-mode-card__arrow")).toHaveCount(0);
  const choicePanelBounds = await dialog.boundingBox();
  expect(choicePanelBounds.width).toBeLessThan(700);
  const listChoice = dialog.locator('[data-print-kind="list"]');
  const testChoice = dialog.locator('[data-print-kind="test"]');
  const [listChoiceBounds, testChoiceBounds] = await Promise.all([
    listChoice.boundingBox(), testChoice.boundingBox(),
  ]);
  expect(listChoiceBounds.width).toBeLessThan(260);
  expect(testChoiceBounds.width).toBeLessThan(260);
  expect(Math.abs((listChoiceBounds.x + listChoiceBounds.width / 2) - (testChoiceBounds.x + testChoiceBounds.width / 2)))
    .toBeLessThan(350);
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath("print-mode-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: testInfo.outputPath("print-mode-tablet.png"), fullPage: true });
  const tabletListChoice = await listChoice.boundingBox();
  const tabletTestChoice = await testChoice.boundingBox();
  expect(tabletListChoice.x).toBeGreaterThanOrEqual(0);
  expect(tabletTestChoice.x + tabletTestChoice.width).toBeLessThanOrEqual(768);
  await page.setViewportSize({ width: 1150, height: 780 });
  await dialog.getByRole("button", { name: /Vokabeltest/ }).click();
  const workspacePanelBounds = await dialog.boundingBox();
  expect(workspacePanelBounds.width).toBeGreaterThan(choicePanelBounds.width + 100);

  await expect(page.locator("#print-selection-count")).toHaveText("10 ausgewählt");
  await expect(page.locator("#print-paper")).toBeVisible();
  await expect(page.locator("#print-preview")).toBeHidden();
  await expect(page.locator(".print-card-row")).toHaveCount(15);
  await expect(page.locator(".print-paper__row")).toHaveCount(10);
  await expect(page.locator("#print-download-button")).toBeEnabled();
  const swapDirection = page.getByRole("button", { name: "Eingabe- und Anzeigesprache tauschen" });
  await expect(swapDirection.locator("img")).toHaveAttribute("src", "./assets/icons/swap-horizontal.svg");
  await swapDirection.click();
  await expect(page.locator("#print-direction-select")).toHaveValue("target-source");
  await expect(page.locator(".print-paper__prompt").first()).toHaveValue("Deutsche Übersetzung 1");
  await page.getByRole("textbox", { name: "Klasse auf dem Blatt" }).fill("9b");
  await page.getByRole("textbox", { name: "Titel auf dem Blatt" }).fill("Mein Testtitel");
  await page.getByRole("textbox", { name: "Arbeitsauftrag auf dem Blatt" }).fill("Übersetze passend.");
  await page.getByRole("textbox", { name: "Begriff 1 auf dem Blatt" }).fill("");
  await expect(page.locator("#print-download-button")).toBeDisabled();
  await page.getByRole("textbox", { name: "Begriff 1 auf dem Blatt" }).fill("Nur auf diesem Blatt");
  await expect(page.locator("#print-download-button")).toBeEnabled();
  await expect(page.locator(".print-card-row").first()).toContainText("English phrase 1");
  await page.screenshot({ path: testInfo.outputPath("print-test-desktop.png"), fullPage: true });

  await page.getByRole("button", { name: "Begriff 1 entfernen" }).click();
  await expect(page.locator(".print-paper__row")).toHaveCount(9);
  await expect(page.locator(".print-card-row").first().getByRole("button")).toHaveAttribute("aria-pressed", "false");
  await page.locator(".print-card-row").first().getByRole("button").click();
  await expect(page.locator(".print-paper__row")).toHaveCount(10);
  await expect(page.locator(".print-paper__prompt").last()).toHaveValue("Deutsche Übersetzung 1");
  await page.locator(".print-card-row").last().getByRole("button").click();
  await expect(page.locator(".print-paper__row")).toHaveCount(11);
  await page.getByRole("button", { name: "Begriff 1: Anzeigeseite tauschen" }).click();
  await expect(page.locator(".print-paper__prompt").first()).toHaveValue("English phrase 2");
  await page.locator("#print-download-button").click();
  await expect.poll(() => printBodies.at(-1)?.kind).toBe("test");
  expect(printBodies.at(-1).cardIds).toHaveLength(11);
  expect(printBodies.at(-1).testDraft.title).toBe("Mein Testtitel");
  expect(printBodies.at(-1).testDraft.className).toBe("9b");
  expect(printBodies.at(-1).testDraft.instruction).toBe("Übersetze passend.");
  expect(printBodies.at(-1).testDraft.items.at(-2).prompt).toBe("Deutsche Übersetzung 1");
  expect(editableSet.cards[0].back).toBe("Deutsche Übersetzung 1");

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(769);
  expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(1025);
  await page.screenshot({ path: testInfo.outputPath("print-test-tablet.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 780 });
  await expect(page.locator("#print-paper")).toBeVisible();
  expect(await page.locator(".print-preview-shell").evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("print-test-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1150, height: 780 });

  await page.locator("#print-back-button").click();
  await dialog.getByRole("button", { name: /Vokabelliste/ }).click();
  await expect(page.locator("#print-config")).toBeHidden();
  await expect.poll(() => printBodies.at(-1)?.kind).toBe("list");
  expect(printBodies.at(-1).cardIds).toHaveLength(15);
  await expect(page.locator("#print-download-button")).toBeEnabled();
});
