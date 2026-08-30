const fs = require("fs/promises");
const path = require("path");
const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const TEACHER_ID = process.env.TEACHER_ID || "julius";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "";
const OUTPUT_DIR = process.env.SCREENSHOT_DIR
  || path.join(process.cwd(), "artifacts", "teacher-header-flow");

test.use({
  baseURL: BASE_URL,
  colorScheme: "dark",
  locale: "de-DE",
});

test.beforeAll(async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
});

async function login(page) {
  await page.goto("/teacher", { waitUntil: "networkidle" });
  await page.getByRole("combobox", { name: "Lehrkraft" }).selectOption(TEACHER_ID);
  await page.getByRole("textbox", { name: "Passwort" }).fill(TEACHER_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.locator("#teacher-shell")).toBeVisible();

  const requiredPasswordDialog = page.getByRole("dialog", { name: "Passwort ändern" });
  if (await requiredPasswordDialog.isVisible()) {
    await requiredPasswordDialog.getByRole("button", { name: "Abbrechen" }).click();
    await expect(requiredPasswordDialog).toBeHidden();
  }
}

for (const viewport of [
  { name: "1150w", width: 1150, height: 760 },
  { name: "720w", width: 720, height: 760 },
  { name: "390w", width: 390, height: 760 },
]) {
  test(`teacher header stays coherent (${viewport.name})`, async ({ page }) => {
    test.skip(!TEACHER_PASSWORD, "TEACHER_PASSWORD fehlt für den Lehrer-Header-Test.");
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await login(page);

    await expect(page.locator(".teacher-header__kicker")).toHaveCount(0);
    await expect(page.locator("#teacher-account-status")).toContainText(/Angemeldet als\s+Julius/);

    const headerBox = await page.locator(".teacher-header").boundingBox();
    const accountBox = await page.locator("#teacher-account-status").boundingBox();
    const accountLabelBox = await page.locator(".teacher-account-status__label").boundingBox();
    const accountNameBox = await page.locator(".teacher-account-status__name").boundingBox();
    const setIconBox = await page.locator("#teacher-shell-icon").boundingBox();
    const setTabBox = await page.locator('[data-teacher-tab="sets"]').boundingBox();
    const tabletTabBox = await page.locator('[data-teacher-tab="tablets"]').boundingBox();
    expect(headerBox.x).toBeGreaterThanOrEqual(0);
    expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(Math.abs(
      (accountBox.y + accountBox.height / 2)
      - (accountLabelBox.y + accountLabelBox.height / 2),
    )).toBeLessThan(1.5);
    expect(Math.abs(
      (accountBox.y + accountBox.height / 2)
      - (accountNameBox.y + accountNameBox.height / 2),
    )).toBeLessThan(1.5);
    expect(Math.abs(setTabBox.width - tabletTabBox.width)).toBeLessThan(1.5);
    expect(Math.abs(setTabBox.height - tabletTabBox.height)).toBeLessThan(1.5);

    await page.locator(".teacher-header").screenshot({
      path: path.join(OUTPUT_DIR, `teacher-header-sets-${viewport.name}.png`),
    });

    await page.getByRole("tab", { name: "Tablets" }).click();
    await expect(page.getByRole("heading", { name: "Tablets", exact: true })).toBeVisible();
    const tabletIconBox = await page.locator("#teacher-shell-icon").boundingBox();
    expect(Math.abs(setIconBox.width - tabletIconBox.width)).toBeLessThan(1.5);
    expect(Math.abs(setIconBox.height - tabletIconBox.height)).toBeLessThan(1.5);

    await page.locator(".teacher-header").screenshot({
      path: path.join(OUTPUT_DIR, `teacher-header-tablets-${viewport.name}.png`),
    });

    await page.getByRole("button", { name: "Einstellungen" }).click();
    await expect(page.getByRole("menuitem", { name: "Passwort ändern" })).toBeVisible();
    const logout = page.getByRole("menuitem", { name: "Abmelden" });
    await expect(logout).toBeVisible();
    await logout.click();
    await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
  });
}
