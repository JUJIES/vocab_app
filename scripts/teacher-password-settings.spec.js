const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const TEACHER_ID = process.env.TEACHER_ID || "julius";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 1024, height: 800 },
  colorScheme: "dark",
  locale: "de-DE",
});

test("teacher settings expose a clean password-change flow", async ({ page }) => {
  test.skip(!TEACHER_PASSWORD, "TEACHER_PASSWORD fehlt für den Passwortdialog-Test.");
  await page.goto("/teacher", { waitUntil: "networkidle" });
  await expect(page.getByText("Einrichtungscode")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Lehrkraft" }).selectOption(TEACHER_ID);
  await page.getByRole("textbox", { name: "Passwort" }).fill(TEACHER_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();

  await page.getByRole("button", { name: "Einstellungen" }).click();
  await page.getByRole("menuitem", { name: "Passwort ändern" }).click();
  const dialog = page.getByRole("dialog", { name: "Passwort ändern" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("textbox", { name: "Aktuelles Passwort" }).fill("nicht-gesendet");
  await dialog.getByRole("textbox", { name: "Neues Passwort", exact: true }).fill("abcdefgh");
  await dialog.getByRole("textbox", { name: "Neues Passwort wiederholen" }).fill("abcdefgi");
  await dialog.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(dialog.getByText("Die neuen Passwörter stimmen nicht überein.")).toBeVisible();
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  await expect(dialog).toBeHidden();
});
