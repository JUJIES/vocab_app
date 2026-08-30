const fs = require("fs/promises");
const path = require("path");
const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const OUTPUT_DIR = process.env.SCREENSHOT_DIR
  || path.join(process.cwd(), "artifacts", "student-login-layout");
const ALLOW_TABLET_MUTATION = process.env.ALLOW_TABLET_MUTATION === "1";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 700, height: 658 },
  colorScheme: "dark",
  locale: "de-DE",
});

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
});

for (const viewport of [
  { name: "1024w", width: 1024, height: 768 },
  { name: "700w", width: 700, height: 658 },
  { name: "390w", width: 390, height: 760 },
]) {
  test(`empty student login offers the valid next step (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload({ waitUntil: "networkidle" });

    await page.getByRole("button", { name: /Weiterlernen/ }).click();
    await expect(page.getByText("Noch kein Tablet eingerichtet", { exact: true })).toBeVisible();
    await expect(page.locator('input[name="pin-entry"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Starten" })).toHaveCount(0);
    const setupButton = page.getByRole("button", { name: "Tablet einrichten" });
    await expect(setupButton).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, `student-login-empty-${viewport.name}.png`),
      fullPage: true,
    });

    await setupButton.click();
    await expect(page.getByRole("heading", { name: "Neu einrichten" })).toBeVisible();
    await expect(page.locator('input[name="registration-pin"]')).toBeVisible();
  });
}

test("configured student login keeps tablet and PIN controls aligned", async ({ page, request }) => {
  test.skip(!ALLOW_TABLET_MUTATION, "Isolierter Tablet-Mutationstest ist nicht aktiviert.");

  const registration = await request.post("/api/tablets/blau-1/register", {
    data: { pin: "4177" },
  });
  expect(registration.ok()).toBeTruthy();

  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Weiterlernen/ }).click();
  await page.waitForTimeout(500);

  const inputBox = await page.locator('input[name="pin-entry"]').boundingBox();
  const iconBox = await page.locator(".student-screen__pin-icon").boundingBox();
  const tabletBox = await page.locator(".student-screen__tablet-input-shell").boundingBox();
  expect(inputBox).not.toBeNull();
  expect(iconBox).not.toBeNull();
  expect(tabletBox).not.toBeNull();
  expect(Math.abs(inputBox.height - tabletBox.height)).toBeLessThan(1.5);
  expect(Math.abs(
    (inputBox.y + inputBox.height / 2)
    - (iconBox.y + iconBox.height / 2),
  )).toBeLessThan(1.5);
});
