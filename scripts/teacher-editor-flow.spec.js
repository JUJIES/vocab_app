const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const TEACHER_ID = process.env.TEACHER_ID || "julius";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 1024, height: 900 },
  colorScheme: "dark",
  locale: "de-DE",
});

async function login(page) {
  await page.goto("/teacher", { waitUntil: "networkidle" });
  await page.getByRole("combobox", { name: "Lehrkraft" }).selectOption(TEACHER_ID);
  await page.getByRole("textbox", { name: "Passwort" }).fill(TEACHER_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.locator("#teacher-shell")).toBeVisible();
  await dismissPasswordOverlay(page);
}

async function dismissPasswordOverlay(page) {
  const passwordOverlay = page.locator("#password-overlay");
  if (await passwordOverlay.isVisible()) {
    await passwordOverlay.getByRole("button", { name: "Schließen" }).click();
  }
}

async function importClearList(page, text) {
  await page.locator("#set-import-text").fill(text);
  await page.getByRole("button", { name: "Entwurf erstellen" }).click();
  await expect(page.locator("#set-editor-form")).toBeVisible();
}

test("teacher editor separates creation, manual editing and automatic additions", async ({ page, request }) => {
  test.skip(!TEACHER_PASSWORD, "TEACHER_PASSWORD fehlt für den Editor-Flow-Test.");
  await login(page);
  const importPurposes = [];
  await page.route("**/api/teacher/import-draft", async (route) => {
    const requestBody = route.request().postDataJSON();
    importPurposes.push(requestBody.purpose);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        importMethod: requestBody.purpose === "create_set" ? "openai" : "structured_text",
        draft: {
          title: "Tiere auf Englisch",
          subject: "Englisch",
          description: "Grundwortschatz zu Tieren",
          sourceLanguage: "de",
          targetLanguage: "en",
          sourceLabel: "Deutsch",
          targetLabel: "Englisch",
          cards: [
            { front: "Hund", back: "dog", acceptedAnswers: ["dog"] },
            { front: "Katze", back: "cat", acceptedAnswers: ["cat"] },
          ],
        },
      }),
    });
  });

  await page.getByRole("button", { name: "Neues Set" }).click();
  await expect(page.locator("#set-editor-choice")).toBeVisible();
  await expect(page.locator("#set-editor-form")).toBeHidden();
  await expect(page.locator("#set-import-section")).toBeHidden();
  await page.locator("#set-editor-overlay > .share-overlay__backdrop").click({ position: { x: 8, y: 8 } });
  await expect(page.locator("#set-editor-overlay")).toBeVisible();

  await page.getByRole("button", { name: /Aus Material erstellen/ }).click();
  await expect(page.locator("#set-import-section")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Material hinzufügen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Zurück" })).toBeVisible();
  await page.locator("#set-import-files").setInputFiles([
    {
      name: "buchseite.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    },
    {
      name: "lektion.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("pdf-preview-fixture"),
    },
  ]);
  await expect(page.getByRole("img", { name: "Vorschau buchseite.png" })).toBeVisible();
  await expect(page.getByLabel("PDF-Datei")).toBeVisible();
  await expect(page.getByText("buchseite.png", { exact: true })).toBeVisible();
  await expect(page.getByText("lektion.pdf", { exact: true })).toBeVisible();
  const addMoreImportContent = page.getByRole("button", { name: "Weitere Inhalte hinzufügen" });
  await expect(addMoreImportContent).toBeVisible();
  await expect(page.getByText(/Verarbeitung über OpenAI/i)).toHaveCount(0);
  await expect(addMoreImportContent).toHaveCSS("justify-self", "center");
  await page.getByRole("button", { name: "lektion.pdf entfernen" }).click();
  await expect(page.getByText("lektion.pdf", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "buchseite.png entfernen" }).click();
  await expect(page.getByRole("button", { name: "Datei auswählen oder ablegen" })).toBeVisible();
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page.locator("#set-editor-choice")).toBeVisible();

  await page.getByRole("button", { name: /Manuell erstellen/ }).click();
  await expect(page.locator("#set-editor-form")).toBeVisible();
  await expect(page.locator("#set-import-section")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Vokabeln" })).toBeVisible();
  const appendVocabulary = page.getByRole("button", { name: "Neue Vokabel hinzufügen" });
  await expect(appendVocabulary).toBeVisible();
  await appendVocabulary.click();
  await expect(page.locator(".set-card-editor-row")).toHaveCount(2);
  await expect(page.locator(".set-card-editor-row").last().locator("input").first()).toBeFocused();
  await expect(appendVocabulary).toBeVisible();
  await page.getByRole("button", { name: "Vokabel 2 entfernen" }).click();
  await page.locator("#set-title-input").fill("Manueller Entwurf bleibt erhalten");
  const firstCardInputs = page.locator(".set-card-editor-row").first().locator("input");
  await firstCardInputs.nth(0).fill("bestehend");
  await firstCardInputs.nth(1).fill("existing");

  await page.getByRole("button", { name: "Automatisch hinzufügen" }).click();
  await expect(page.locator("#set-import-section")).toBeVisible();
  await expect(page.locator("#set-editor-form")).toBeHidden();
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page.locator("#set-title-input")).toHaveValue("Manueller Entwurf bleibt erhalten");
  await page.getByRole("button", { name: "Automatisch hinzufügen" }).click();
  await importClearList(page, "Hund; dog\nKatze; cat");
  await expect(page.locator("#set-title-input")).toHaveValue("Manueller Entwurf bleibt erhalten");
  await expect(page.locator(".set-card-editor-row")).toHaveCount(3);
  await expect(page.locator("#set-import-section")).toBeHidden();

  await page.locator("#set-editor-close").click();
  const preservedDraft = page.locator(".teacher-set-row").filter({ hasText: "Manueller Entwurf bleibt erhalten" });
  await expect(preservedDraft).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entwürfe (1)" })).toBeVisible();
  await expect(preservedDraft.getByText("Entwurf", { exact: true })).toBeVisible();
  await expect(preservedDraft.getByRole("button", { name: /teilen/i })).toHaveCount(0);
  await preservedDraft.getByRole("button", { name: /bearbeiten/i }).click();
  await expect(page.locator("#set-title-input")).toHaveValue("Manueller Entwurf bleibt erhalten");
  await expect(page.locator(".set-card-editor-row")).toHaveCount(3);
  await page.locator("#set-editor-close").click();

  await page.getByRole("button", { name: "Neues Set" }).click();
  await page.getByRole("button", { name: /Aus Material erstellen/ }).click();
  await expect(page.locator("#set-import-section")).toBeVisible();
  await importClearList(page, "Sonne; sun\nMond; moon");
  await expect(page.locator(".set-card-editor-row")).toHaveCount(2);
  await expect(page.locator("#set-title-input")).toHaveValue("Tiere auf Englisch");
  await expect(page.locator("#set-subject-input")).toHaveValue("Englisch");
  await expect(page.locator("#set-description-input")).toHaveValue("Grundwortschatz zu Tieren");
  const frontSide = page.locator('[data-editor-side-select="front"]');
  const backSide = page.locator('[data-editor-side-select="back"]');
  await expect(frontSide).toHaveValue("");
  await expect(backSide).toBeDisabled();
  await frontSide.selectOption("de");
  await backSide.selectOption("en");
  await expect(page.locator("#set-source-label-input")).toHaveValue("Deutsch");
  await expect(page.locator("#set-target-label-input")).toHaveValue("Englisch");
  await expect(page.locator("#set-import-section")).toBeHidden();

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("#teacher-shell")).toBeVisible();
  await dismissPasswordOverlay(page);
  await expect(page.getByRole("heading", { name: "Entwürfe (2)" })).toBeVisible();
  const reloadedDraft = page.locator(".teacher-set-row").filter({ hasText: "Tiere auf Englisch" });
  await expect(reloadedDraft.getByText("Entwurf", { exact: true })).toBeVisible();
  await reloadedDraft.getByRole("button", { name: /bearbeiten/i }).click();
  await expect(page.locator("#set-title-input")).toHaveValue("Tiere auf Englisch");
  await expect(page.locator(".set-card-editor-row")).toHaveCount(2);
  await expect(page.locator('[data-editor-side-select="front"]')).toHaveValue("de");
  await expect(page.locator('[data-editor-side-select="back"]')).toHaveValue("en");
  await page.getByRole("button", { name: "Set veröffentlichen" }).click();
  await expect(page.locator("#share-overlay")).toBeVisible();
  const publishedShareCode = (await page.locator("#share-code").textContent()).trim();
  await page.locator("#share-close-button").click();
  const publishedSet = page.locator(".teacher-set-row").filter({ hasText: "Tiere auf Englisch" });
  await expect(publishedSet.getByText("Entwurf", { exact: true })).toHaveCount(0);
  await expect(publishedSet.getByRole("button", { name: /teilen/i })).toBeVisible();
  await publishedSet.getByRole("button", { name: /bearbeiten/i }).click();
  await expect(page.locator("#set-editor-form")).toBeVisible();
  await expect(page.locator("#set-editor-choice")).toBeHidden();
  await expect(page.locator("#set-import-section")).toBeHidden();
  await page.getByRole("button", { name: "Bild zu Vokabel 1 erstellen" }).click();
  await expect(page.getByLabel("Bildwunsch für Vokabel 1")).toBeVisible();
  await expect(page.getByLabel("Bildwunsch für Vokabel 1")).toHaveAttribute(
    "placeholder",
    "z. B. roter Bus von der Seite",
  );
  await page.getByRole("button", { name: "Bild zu Vokabel 1 erstellen" }).click();

  const originalTitle = await page.locator("#set-title-input").inputValue();
  const originalCardCount = await page.locator(".set-card-editor-row").count();
  await page.getByRole("button", { name: "Automatisch hinzufügen" }).click();
  await importClearList(page, "neu; new\nmehr; more");
  await expect(page.locator("#set-title-input")).toHaveValue(originalTitle);
  await expect(page.locator(".set-card-editor-row")).toHaveCount(originalCardCount + 2);
  expect(importPurposes).toEqual(["append_cards", "create_set", "append_cards"]);

  await page.locator("#set-editor-close").click();
  const publishedSetAfterEdit = page.locator(".teacher-set-row").filter({ hasText: "Tiere auf Englisch" });
  const deletePublishedSet = publishedSetAfterEdit.getByRole("button", { name: "Set Tiere auf Englisch löschen" });
  await expect(deletePublishedSet).toBeVisible();
  await deletePublishedSet.click();
  await expect(page.getByRole("dialog", { name: "Set löschen?" })).toBeVisible();
  await expect(page.locator("#delete-set-copy")).toHaveText("„Tiere auf Englisch“ wirklich löschen?");
  await page.locator("#delete-set-cancel").click();
  await expect(page.locator("#delete-set-overlay")).toBeHidden();
  await expect(publishedSetAfterEdit).toBeVisible();

  await deletePublishedSet.click();
  await page.locator("#delete-set-confirm").click();
  await expect(publishedSetAfterEdit).toHaveCount(0);
  const deletedCodeResponse = await request.get(`/api/set-codes/${publishedShareCode}`);
  expect(deletedCodeResponse.status()).toBe(404);

  const savedDraft = page.locator(".teacher-set-row").filter({ hasText: "Manueller Entwurf bleibt erhalten" });
  await savedDraft.getByRole("button", { name: "Set Manueller Entwurf bleibt erhalten löschen" }).click();
  await page.locator("#delete-set-confirm").click();
  await expect(savedDraft).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^Entwürfe/ })).toHaveCount(0);
});

test("teacher editor keeps a usable add-vocabulary row after every entry", async ({ page }, testInfo) => {
  const editableSet = {
    id: "set-1", path: "sets/user/set-1.json", status: "published", editable: true, title: "Zoom in",
    ownerTeacherId: "julius", ownerDisplayName: "Julius",
    sourceLanguage: "en", targetLanguage: "de", sourceLabel: "Englisch", targetLabel: "Deutsch",
    cardCount: 2, cards: [
      { id: "card-1", front: "street gangs", back: "Straßenbanden", acceptedAnswers: [] },
      { id: "card-2", front: "mural", back: "Wandbild", acceptedAnswers: [] },
    ],
    tablets: [],
  };
  await page.route("**/api/runtime-info", (route) => route.fulfill({ json: { publicOrigin: BASE_URL } }));
  await page.route("**/api/teacher/accounts", (route) => route.fulfill({
    json: { accounts: [{ id: "julius", displayName: "Julius" }] },
  }));
  await page.route("**/api/teacher/session", (route) => route.fulfill({
    json: { session: { teacherId: "julius" }, teacher: { id: "julius", displayName: "Julius" } },
  }));
  await page.route("**/api/sets", (route) => route.fulfill({
    json: { sets: [{ ...editableSet, cards: undefined }], teacher: { id: "julius" }, importConfigured: true },
  }));
  await page.route("**/api/tablets", (route) => route.fulfill({ json: { tablets: [] } }));
  await page.route("**/api/teacher/visual-jobs", (route) => route.fulfill({ json: { jobs: [] } }));
  await page.route("**/api/teacher/sets/set-1/visual-assets", (route) => route.fulfill({ json: { assets: [], jobs: [] } }));
  await page.route("**/api/teacher/sets/set-1", (route) => route.fulfill({ json: { set: editableSet } }));

  await page.goto("/teacher", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Set Zoom in bearbeiten" }).click();
  const addRow = page.getByRole("button", { name: "Neue Vokabel hinzufügen" });
  await expect(page.getByRole("heading", { name: "Vokabeln" })).toBeVisible();
  await expect(page.locator("#set-card-count")).toHaveText("2 Vokabeln");
  await expect(addRow).toBeVisible();
  await page.locator(".set-card-editor-list").screenshot({ path: testInfo.outputPath("editor-add-desktop.png") });

  await addRow.click();
  await expect(page.locator(".set-card-editor-row")).toHaveCount(3);
  await expect(page.locator("#set-card-count")).toHaveText("3 Vokabeln");
  await expect(page.locator(".set-card-editor-row").last().locator("input").first()).toBeFocused();
  await expect(addRow).toBeVisible();
  await page.locator(".set-card-editor-row").last().locator("input").first().fill("school");
  await page.locator(".set-card-editor-row").last().locator("input").nth(1).fill("Schule");
  await page.getByRole("button", { name: "Vokabel hinzufügen", exact: true }).click();
  await expect(page.locator(".set-card-editor-row")).toHaveCount(4);
  await expect(addRow).toBeVisible();

  await page.setViewportSize({ width: 768, height: 1024 });
  await addRow.scrollIntoViewIfNeeded();
  await page.locator(".set-card-editor-list").screenshot({ path: testInfo.outputPath("editor-add-tablet.png") });
  const addBounds = await addRow.boundingBox();
  expect(addBounds.x).toBeGreaterThanOrEqual(0);
  expect(addBounds.x + addBounds.width).toBeLessThanOrEqual(768);

  const saveRequest = page.waitForRequest((request) =>
    request.url().endsWith("/api/teacher/sets/set-1") && request.method() === "PUT");
  await page.getByRole("button", { name: "Änderungen speichern" }).click();
  const savedPayload = (await saveRequest).postDataJSON();
  const savedCards = savedPayload.cards;
  expect(savedCards).toHaveLength(3);
  expect(savedCards.at(-1)).toMatchObject({ front: "school", back: "Schule" });
  expect(savedPayload.sidePreset).toBe("languages");
});

test("a new set requires a deliberate front and back choice", async ({ page }, testInfo) => {
  await page.route("**/api/runtime-info", (route) => route.fulfill({ json: { publicOrigin: BASE_URL } }));
  await page.route("**/api/teacher/accounts", (route) => route.fulfill({
    json: { accounts: [{ id: "julius", displayName: "Julius" }] },
  }));
  await page.route("**/api/teacher/session", (route) => route.fulfill({
    json: { session: { teacherId: "julius" }, teacher: { id: "julius", displayName: "Julius" } },
  }));
  await page.route("**/api/sets", (route) => route.fulfill({
    json: { sets: [], teacher: { id: "julius" }, importConfigured: true },
  }));
  await page.route("**/api/tablets", (route) => route.fulfill({ json: { tablets: [] } }));
  await page.route("**/api/teacher/visual-jobs", (route) => route.fulfill({ json: { jobs: [] } }));

  await page.goto("/teacher", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Neues Set" }).click();
  await page.getByRole("button", { name: /Manuell erstellen/ }).click();
  const front = page.locator('[data-editor-side-select="front"]');
  const back = page.locator('[data-editor-side-select="back"]');
  await expect(front).toHaveValue("");
  await expect(back).toBeDisabled();
  await page.getByRole("button", { name: "Set veröffentlichen" }).click();
  await expect(page.locator("#set-side-feedback")).toBeVisible();
  await expect(front).toBeFocused();
  await page.locator(".set-card-editor-columns").screenshot({ path: testInfo.outputPath("side-choice-desktop.png") });
  await front.selectOption("question");
  await expect(back).toBeEnabled();
  await expect(back.locator("option")).toHaveCount(2);
  await back.selectOption("answer");
  await expect(page.locator("#set-source-label-input")).toHaveValue("Frage");
  await expect(page.locator("#set-target-label-input")).toHaveValue("Antwort");
  await expect(page.locator("#set-side-feedback")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 760 });
  await page.locator(".set-card-editor-columns").screenshot({ path: testInfo.outputPath("side-choice-mobile.png") });
});
