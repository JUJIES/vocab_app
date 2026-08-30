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
}

async function importClearList(page, text) {
  await page.locator("#set-import-text").fill(text);
  await page.getByRole("button", { name: "Entwurf erstellen" }).click();
  await expect(page.locator("#set-editor-form")).toBeVisible();
}

test("teacher editor separates creation, manual editing and automatic additions", async ({ page }) => {
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

  await page.getByRole("button", { name: /Aus Material erstellen/ }).click();
  await expect(page.locator("#set-import-section")).toBeVisible();
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page.locator("#set-editor-choice")).toBeVisible();

  await page.getByRole("button", { name: /Manuell erstellen/ }).click();
  await expect(page.locator("#set-editor-form")).toBeVisible();
  await expect(page.locator("#set-import-section")).toBeHidden();
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
  await page.getByRole("button", { name: "Neues Set" }).click();
  await page.getByRole("button", { name: /Aus Material erstellen/ }).click();
  await expect(page.locator("#set-import-section")).toBeVisible();
  await importClearList(page, "Sonne; sun\nMond; moon");
  await expect(page.locator(".set-card-editor-row")).toHaveCount(2);
  await expect(page.locator("#set-title-input")).toHaveValue("Tiere auf Englisch");
  await expect(page.locator("#set-subject-input")).toHaveValue("Englisch");
  await expect(page.locator("#set-description-input")).toHaveValue("Grundwortschatz zu Tieren");
  await expect(page.locator("#set-source-label-input")).toHaveValue("Deutsch");
  await expect(page.locator("#set-target-label-input")).toHaveValue("Englisch");
  await expect(page.locator("#set-import-section")).toBeHidden();

  await page.locator("#set-editor-close").click();
  await page.getByRole("button", { name: /bearbeiten$/i }).first().click();
  await expect(page.locator("#set-editor-form")).toBeVisible();
  await expect(page.locator("#set-editor-choice")).toBeHidden();
  await expect(page.locator("#set-import-section")).toBeHidden();

  const originalTitle = await page.locator("#set-title-input").inputValue();
  const originalCardCount = await page.locator(".set-card-editor-row").count();
  await page.getByRole("button", { name: "Automatisch hinzufügen" }).click();
  await importClearList(page, "neu; new\nmehr; more");
  await expect(page.locator("#set-title-input")).toHaveValue(originalTitle);
  await expect(page.locator(".set-card-editor-row")).toHaveCount(originalCardCount + 2);
  expect(importPurposes).toEqual(["append_cards", "create_set", "append_cards"]);
});
