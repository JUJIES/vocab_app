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
  await printButton.click();

  const dialog = page.getByRole("dialog", { name: "Means of transport" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Vokabelliste/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Vokabeltest/ })).toBeVisible();
  await dialog.getByRole("button", { name: /Vokabeltest/ }).click();

  await expect(page.locator("#print-selection-count")).toHaveText("10 ausgewählt");
  await expect.poll(() => printBodies.length).toBeGreaterThan(0);
  expect(printBodies.at(-1).kind).toBe("test");
  expect(printBodies.at(-1).cardIds).toHaveLength(10);
  await expect(page.locator("#print-preview")).toBeVisible();
  await expect(page.locator("#print-download-button")).toBeEnabled();
  const swapDirection = page.getByRole("button", { name: "Eingabe- und Anzeigesprache tauschen" });
  await expect(swapDirection.locator("img")).toHaveAttribute("src", "./assets/icons/swap-horizontal.svg");
  await swapDirection.click();
  await expect(page.locator("#print-direction-select")).toHaveValue("target-source");
  await expect.poll(() => printBodies.at(-1)?.direction).toBe("target-source");
  await expect(page.locator(".print-card-row.is-selected .print-card-row__copy strong").first())
    .toHaveText("Deutsche Übersetzung 1");
  await page.waitForTimeout(800);
  await page.screenshot({ path: testInfo.outputPath("print-test-desktop.png"), fullPage: true });

  const firstPromptBefore = await page.locator(".print-card-row.is-selected .print-card-row__copy strong").first().textContent();
  await page.locator(".print-card-row.is-selected").first().getByRole("button", { name: "Nach unten" }).click();
  const firstPromptAfter = await page.locator(".print-card-row.is-selected .print-card-row__copy strong").first().textContent();
  expect(firstPromptAfter).not.toBe(firstPromptBefore);

  await page.locator("#print-select-none").click();
  await expect(page.locator("#print-selection-count")).toHaveText("0 ausgewählt");
  await expect(page.locator("#print-download-button")).toBeDisabled();
  await expect(page.locator("#print-feedback")).toContainText("mindestens eine");
  await page.locator("#print-select-all").click();
  await expect(page.locator("#print-selection-count")).toHaveText("15 ausgewählt");
  await expect.poll(() => printBodies.at(-1)?.cardIds?.length).toBe(15);
  await expect(page.locator("#print-download-button")).toBeEnabled();

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(769);
  expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(1025);
  await page.screenshot({ path: testInfo.outputPath("print-test-tablet.png"), fullPage: true });

  await page.locator("#print-back-button").click();
  await dialog.getByRole("button", { name: /Vokabelliste/ }).click();
  await expect(page.locator("#print-config")).toBeHidden();
  await expect.poll(() => printBodies.at(-1)?.kind).toBe("list");
  expect(printBodies.at(-1).cardIds).toHaveLength(15);
  await expect(page.locator("#print-download-button")).toBeEnabled();
});
