const fs = require("fs/promises");
const path = require("path");
const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const OUTPUT_DIR = process.env.SCREENSHOT_DIR
  || path.join(process.cwd(), "artifacts", "student-login-layout");

test.use({
  baseURL: BASE_URL,
  viewport: { width: 700, height: 658 },
  colorScheme: "dark",
  locale: "de-DE",
});

test.beforeAll(async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
});

for (const viewport of [
  { name: "1024w", width: 1024, height: 768 },
  { name: "700w", width: 700, height: 658 },
  { name: "390w", width: 390, height: 760 },
]) {
  test(`empty student login stays concise and aligns the key (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload({ waitUntil: "networkidle" });

    await page.getByRole("button", { name: /Weiterlernen/ }).click();
    await expect(page.getByText("Kein Tablet eingerichtet", { exact: true })).toBeVisible();
    await expect(page.getByText(/Nutze stattdessen/)).toHaveCount(0);
    await page.waitForTimeout(500);

    const inputBox = await page.locator('input[name="pin-entry"]').boundingBox();
    const iconBox = await page.locator(".student-screen__pin-icon").boundingBox();
    expect(inputBox).not.toBeNull();
    expect(iconBox).not.toBeNull();
    expect(Math.abs(
      (inputBox.y + inputBox.height / 2)
      - (iconBox.y + iconBox.height / 2),
    )).toBeLessThan(1.5);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, `student-login-empty-${viewport.name}.png`),
      fullPage: true,
    });
  });
}
