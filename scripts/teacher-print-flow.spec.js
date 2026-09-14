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
    title: "Means of transport – Klasse 9/10 mit besonders langem Reihentitel",
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
    const body = JSON.parse(route.request().postData() || "{}");
    printBodies.push(body);
    const pdf = await createVocabularyPrintPdf({ set: editableSet, ...body });
    await route.fulfill({ status: 200, contentType: "application/pdf", body: pdf });
  });
  await page.route("**/api/teacher/sets/set-1", (route) => route.fulfill({ json: { set: editableSet } }));

  await page.goto("/teacher", { waitUntil: "networkidle" });
  const printButton = page.getByRole("button", { name: /Set Means of transport.*ausdrucken/ });
  await expect(printButton).toBeVisible();
  await expect(printButton.locator("img")).toHaveAttribute("src", "./assets/icons/print.svg");
  await page.locator(".teacher-set-row").first().screenshot({ path: testInfo.outputPath("set-actions-desktop.png") });
  await page.setViewportSize({ width: 390, height: 780 });
  await page.locator(".teacher-set-row").first().screenshot({ path: testInfo.outputPath("set-actions-mobile.png") });
  await page.setViewportSize({ width: 1150, height: 780 });
  await printButton.click();

  const dialog = page.getByRole("dialog", { name: /Means of transport/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Vokabelliste/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Vokabeltest/ })).toBeVisible();
  await expect(dialog.locator(".print-mode-card small")).toHaveCount(0);
  await expect(dialog.locator('[data-print-kind="list"] .print-mode-card__icon'))
    .toHaveAttribute("src", "./assets/icons/print-vocabulary-list.png");
  await expect(dialog.locator('[data-print-kind="test"] .print-mode-card__icon'))
    .toHaveAttribute("src", "./assets/icons/print-vocabulary-test.png");
  await expect(dialog.locator(".print-mode-card__arrow")).toHaveCount(0);
  const choicePanelBounds = await dialog.boundingBox();
  expect(choicePanelBounds.width).toBeLessThan(700);
  const printTitle = dialog.locator("#print-title");
  await expect(printTitle).toHaveCSS("text-overflow", "ellipsis");
  expect(await printTitle.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  const listChoice = dialog.locator('[data-print-kind="list"]');
  const testChoice = dialog.locator('[data-print-kind="test"]');
  const [listChoiceBounds, testChoiceBounds] = await Promise.all([
    listChoice.boundingBox(), testChoice.boundingBox(),
  ]);
  expect(listChoiceBounds.width).toBeLessThan(260);
  expect(testChoiceBounds.width).toBeLessThan(260);
  expect(Math.abs(listChoiceBounds.width - testChoiceBounds.width)).toBeLessThan(1);
  for (const choice of [listChoice, testChoice]) {
    const card = await choice.boundingBox();
    for (const content of [choice.locator("img"), choice.locator("strong")]) {
      const bounds = await content.boundingBox();
      expect(Math.abs((bounds.x + bounds.width / 2) - (card.x + card.width / 2))).toBeLessThan(1);
      expect(bounds.x - card.x).toBeGreaterThan(20);
    }
  }
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
  const previewBounds = await page.locator(".print-preview-shell").boundingBox();
  const footerBounds = await page.locator(".print-footer").boundingBox();
  expect(previewBounds.y + previewBounds.height).toBeLessThanOrEqual(footerBounds.y + 1);
  for (const viewport of [{ width: 1150, height: 600 }, { width: 1024, height: 540 }]) {
    await page.setViewportSize(viewport);
    const compactPreview = await page.locator(".print-preview-shell").boundingBox();
    const compactFooter = await page.locator(".print-footer").boundingBox();
    expect(compactPreview.y + compactPreview.height).toBeLessThanOrEqual(compactFooter.y + 1);
    expect(await page.locator("#print-download-button").evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      const target = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      return target === button || button.contains(target);
    })).toBe(true);
    if (viewport.height === 540) {
      await page.screenshot({ path: testInfo.outputPath("print-test-compact.png"), fullPage: true });
    }
  }
  for (const viewport of [{ width: 768, height: 540 }, { width: 390, height: 540 }]) {
    await page.setViewportSize(viewport);
    expect(await page.locator("#print-download-button").evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      const target = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      return target === button || button.contains(target);
    })).toBe(true);
  }
  await page.setViewportSize({ width: 1150, height: 780 });
  const swapDirection = page.getByRole("button", { name: "Standardrichtung der Begriffe tauschen" });
  await expect(page.locator("#print-swap-direction")).toBeHidden();
  await expect(swapDirection).toBeVisible();
  await expect(swapDirection.locator("img")).toHaveAttribute("src", "./assets/icons/swap-horizontal.svg");
  const [leftHeadingBounds, swapDirectionBounds, rightHeadingBounds] = await Promise.all([
    page.getByRole("textbox", { name: "Überschrift der linken Spalte" }).boundingBox(),
    swapDirection.boundingBox(),
    page.getByRole("textbox", { name: "Überschrift der rechten Spalte" }).boundingBox(),
  ]);
  expect(swapDirectionBounds.x).toBeGreaterThanOrEqual(leftHeadingBounds.x + leftHeadingBounds.width - 1);
  expect(swapDirectionBounds.x + swapDirectionBounds.width).toBeLessThanOrEqual(rightHeadingBounds.x + 1);
  await swapDirection.click();
  await expect(page.locator("#print-direction-select")).toHaveValue("target-source");
  await expect(page.locator(".print-paper__prompt").first()).toHaveValue("Deutsche Übersetzung 1");
  await page.getByRole("textbox", { name: "Klasse auf dem Blatt" }).fill("9b");
  await page.getByRole("textbox", { name: "Titel auf dem Blatt" }).fill("Mein Testtitel");
  await page.getByRole("textbox", { name: "Arbeitsauftrag auf dem Blatt" }).fill("Übersetze passend.");
  const leftHeading = page.getByRole("textbox", { name: "Überschrift der linken Spalte" });
  const rightHeading = page.getByRole("textbox", { name: "Überschrift der rechten Spalte" });
  await expect(leftHeading).toHaveValue("Begriff");
  await expect(rightHeading).toHaveValue("Antwort");
  await leftHeading.fill("Deutsch");
  await rightHeading.fill("");
  await expect(page.locator("#print-download-button")).toBeDisabled();
  await expect(page.locator("#print-feedback")).toHaveText("Bitte beide Spaltenüberschriften ausfüllen.");
  await rightHeading.fill("Englisch");
  await expect(page.locator("#print-download-button")).toBeEnabled();
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
  await expect(page.locator(".print-paper__swap").first()).toBeVisible();
  await expect(page.locator(".print-paper__remove").first()).toBeVisible();
  const swapBounds = await page.locator(".print-paper__swap").first().boundingBox();
  const answerBounds = await page.locator(".print-paper__answer-line").first().boundingBox();
  expect(swapBounds.x + swapBounds.width).toBeLessThanOrEqual(answerBounds.x + 1);
  const firstHandle = page.locator(".print-paper__handle").first();
  const dragFrom = await firstHandle.boundingBox();
  const dragTo = await page.locator(".print-paper__row").nth(2).boundingBox();
  await page.mouse.move(dragFrom.x + dragFrom.width / 2, dragFrom.y + dragFrom.height / 2);
  await page.mouse.down();
  await expect(page.locator(".print-paper__drag-preview")).toHaveCount(1);
  await expect(page.locator(".print-paper__drag-preview")).toContainText("Deutsche Übersetzung 2");
  const dragPreviewStart = await page.locator(".print-paper__drag-preview").boundingBox();
  await page.mouse.move(dragTo.x + 12, dragTo.y + dragTo.height / 2, { steps: 5 });
  const dragPreviewMoved = await page.locator(".print-paper__drag-preview").boundingBox();
  expect(dragPreviewMoved.y).toBeGreaterThan(dragPreviewStart.y);
  await expect(page.locator(".print-paper__row.is-drop-target")).toHaveAttribute("data-drop-position", "after");
  await page.screenshot({ path: testInfo.outputPath("print-test-dragging.png"), fullPage: true });
  await page.mouse.up();
  await expect(page.locator(".print-paper__drag-preview")).toHaveCount(0);
  await expect(page.locator(".print-paper__prompt").first()).toHaveValue("Deutsche Übersetzung 3");
  await page.locator(".print-paper__handle").first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".print-paper__prompt").first()).toHaveValue("Deutsche Übersetzung 4");
  await page.getByRole("button", { name: "Begriff 1: Anzeigeseite tauschen" }).click();
  await expect(page.locator(".print-paper__prompt").first()).toHaveValue("English phrase 4");
  await page.locator("#print-download-button").click();
  await expect.poll(() => printBodies.at(-1)?.kind).toBe("test");
  expect(printBodies.at(-1).cardIds).toHaveLength(11);
  expect(printBodies.at(-1).cardIds[0]).toBe("card-4");
  expect(printBodies.at(-1).testDraft.title).toBe("Mein Testtitel");
  expect(printBodies.at(-1).testDraft.className).toBe("9b");
  expect(printBodies.at(-1).testDraft.instruction).toBe("Übersetze passend.");
  expect(printBodies.at(-1).testDraft.leftHeading).toBe("Deutsch");
  expect(printBodies.at(-1).testDraft.rightHeading).toBe("Englisch");
  expect(printBodies.at(-1).testDraft.items.at(-2).prompt).toBe("Deutsche Übersetzung 1");
  expect(editableSet.cards[0].back).toBe("Deutsche Übersetzung 1");

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(769);
  expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(1025);
  expect(await page.locator("#print-download-button").evaluate((button) => {
    const bounds = button.getBoundingClientRect();
    const target = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return target === button || button.contains(target);
  })).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("print-test-tablet.png"), fullPage: true });
  const tabletHandle = await page.locator(".print-paper__handle").first().boundingBox();
  const tabletTarget = await page.locator(".print-paper__row").nth(2).boundingBox();
  const touch = await page.context().newCDPSession(page);
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart", touchPoints: [{ x: tabletHandle.x + 8, y: tabletHandle.y + 12, id: 1 }],
  });
  await expect(page.locator(".print-paper__drag-preview")).toHaveCount(1);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove", touchPoints: [{ x: tabletTarget.x + 12, y: tabletTarget.y + 15, id: 1 }],
  });
  await expect(page.locator(".print-paper__row.is-drop-target")).toHaveAttribute("data-drop-position", "after");
  await page.waitForTimeout(150);
  await page.screenshot({ path: testInfo.outputPath("print-test-touch-dragging.png"), fullPage: true });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator(".print-paper__drag-preview")).toHaveCount(0);
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await expect(page.locator(".print-paper__prompt").first()).toHaveValue("Deutsche Übersetzung 3");
  await page.setViewportSize({ width: 390, height: 780 });
  await expect(page.locator("#print-paper")).toBeVisible();
  expect(await page.locator(".print-preview-shell").evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.locator("#print-download-button").evaluate((button) => {
    const bounds = button.getBoundingClientRect();
    const target = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return target === button || button.contains(target);
  })).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("print-test-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1150, height: 780 });

  await page.locator("#print-back-button").click();
  await dialog.getByRole("button", { name: /Vokabelliste/ }).click();
  await expect(page.locator("#print-list-paper")).toBeVisible();
  await expect(page.locator("#print-list-paper")).toContainText("English phrase 1");
  await expect(page.locator("#print-list-paper")).toContainText("Deutsche Übersetzung 1");
  await expect(page.locator(".print-list__row")).toHaveCount(15);
  await expect(page.locator(".print-list__term").first()).toContainText("Deutsche Übersetzung 1");
  await expect(page.locator("#print-preview")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("print-list-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator("#print-list-paper")).toBeVisible();
  await expect(page.locator(".print-list__row")).toHaveCount(15);
  await page.screenshot({ path: testInfo.outputPath("print-list-tablet.png"), fullPage: true });
  await page.setViewportSize({ width: 1150, height: 780 });
  await expect(page.locator("#print-config")).toBeHidden();
  await expect(page.locator("#print-swap-direction")).toBeVisible();
  await expect.poll(() => printBodies.at(-1)?.kind).toBe("list");
  expect(printBodies.at(-1).direction).toBe("target-source");
  expect(printBodies.at(-1).cardIds).toHaveLength(15);
  await expect(page.locator("#print-download-button")).toBeEnabled();
  await page.locator("#print-swap-direction").click();
  await expect(page.locator(".print-list__term").first()).toContainText("English phrase 1");
  await expect(page.locator(".print-list__translation").first()).toContainText("Deutsche Übersetzung 1");
  await expect.poll(() => printBodies.at(-1)?.direction).toBe("source-target");
  await expect(page.locator("#print-download-button")).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#print-download-button").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^vokabelliste-.*\.pdf$/);
});
