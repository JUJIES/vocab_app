const fs = require("fs/promises");
const path = require("path");
const { test, expect } = require("./teacher-release-fixture.cjs");

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

test("teacher login brand uses an unframed icon beside the wordmark", async ({ page }) => {
  for (const viewport of [
    { name: "tablet", width: 1024, height: 768 },
    { name: "mobile", width: 390, height: 760 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/teacher", { waitUntil: "networkidle" });
    const iconStyle = await page.locator(".teacher-auth__brand-icon").evaluate((icon) => {
      const style = getComputedStyle(icon);
      return {
        backgroundColor: style.backgroundColor,
        borderWidth: style.borderWidth,
        borderRadius: Number.parseFloat(style.borderRadius),
      };
    });
    expect(iconStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(iconStyle.borderWidth).toBe("0px");
    expect(iconStyle.borderRadius).toBe(0);
    const brandBox = await page.locator(".teacher-auth__brand").boundingBox();
    expect(brandBox.x).toBeGreaterThanOrEqual(0);
    expect(brandBox.x + brandBox.width).toBeLessThanOrEqual(viewport.width + 1);
    await page.locator(".teacher-auth__brand").screenshot({
      path: path.join(OUTPUT_DIR, `teacher-login-brand-${viewport.name}.png`),
    });
  }
});

for (const viewport of [
  { name: "1150w", width: 1150, height: 760 },
  { name: "720w", width: 720, height: 760 },
  { name: "390w", width: 390, height: 760 },
  { name: "320w", width: 320, height: 760 },
]) {
  test(`teacher header stays coherent (${viewport.name})`, async ({ page }) => {
    test.skip(!TEACHER_PASSWORD, "TEACHER_PASSWORD fehlt für den Lehrer-Header-Test.");
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await login(page);

    await expect(page.locator(".teacher-header__kicker")).toHaveCount(0);
    await expect(page.locator("#teacher-account-status")).toContainText(/Angemeldet als\s+Julius/);

    const headerBox = await page.locator(".teacher-header").boundingBox();
    const accountBox = await page.locator("#teacher-account-status").boundingBox();
    await expect(page.locator(".teacher-account-status__label")).toBeHidden();
    const accountNameBox = await page.locator(".teacher-account-status__name").boundingBox();
    const setIconBox = await page.locator("#teacher-shell-icon").boundingBox();
    const toggleBox = await page.locator("#teacher-section-toggle").boundingBox();
    expect(headerBox.x).toBeGreaterThanOrEqual(0);
    expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(Math.abs(
      (accountBox.y + accountBox.height / 2)
      - (accountNameBox.y + accountNameBox.height / 2),
    )).toBeLessThan(1.5);
    expect(toggleBox.x).toBeGreaterThanOrEqual(headerBox.x);
    expect(toggleBox.x + toggleBox.width).toBeLessThan(accountBox.x);
    await page.locator("#teacher-section-toggle").click();
    const setChoiceBox = await page.locator('[data-teacher-section="sets"]').boundingBox();
    const tabletChoiceBox = await page.locator('[data-teacher-section="tablets"]').boundingBox();
    expect(tabletChoiceBox.y).toBeGreaterThanOrEqual(setChoiceBox.y + setChoiceBox.height);
    expect(Math.abs(setChoiceBox.width - tabletChoiceBox.width)).toBeLessThan(1.5);
    expect(tabletChoiceBox.x + tabletChoiceBox.width).toBeLessThanOrEqual(viewport.width);
    await page.locator("#teacher-section-toggle").press("Escape");

    await page.locator(".teacher-header").screenshot({
      path: path.join(OUTPUT_DIR, `teacher-header-sets-${viewport.name}.png`),
    });

    await page.locator("#teacher-section-toggle").click();

    await page.getByRole("menuitemradio", { name: "Tablets" }).click();
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
