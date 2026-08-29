const fs = require("fs/promises");
const path = require("path");
const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const TEACHER_ID = process.env.TEACHER_ID || "julius";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "";
const OUTPUT_DIR = process.env.SCREENSHOT_DIR
  || path.join(process.cwd(), "artifacts", "teacher-share-qr");

test.use({
  baseURL: BASE_URL,
  viewport: { width: 1024, height: 900 },
  colorScheme: "dark",
  locale: "de-DE",
});

test.beforeAll(async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
});

test("teacher share QR is centered inside its frame", async ({ page }) => {
  test.skip(!TEACHER_PASSWORD, "TEACHER_PASSWORD fehlt für den Lehrer-QR-Test.");

  await page.goto("/teacher", { waitUntil: "networkidle" });
  await page.getByRole("combobox", { name: "Lehrkraft" }).selectOption(TEACHER_ID);
  await page.getByRole("textbox", { name: "Passwort" }).fill(TEACHER_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.locator("#teacher-shell")).toBeVisible();
  await page.getByRole("button", { name: /teilen/i }).first().click();
  await expect(page.locator("#share-overlay")).toBeVisible();
  await expect(page.getByRole("button", { name: "Link kopieren" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Drucken" })).toHaveCount(0);
  await page.waitForTimeout(150);

  const metrics = await page.evaluate(() => {
    const frame = document.querySelector(".share-panel__qr-frame");
    const canvas = document.getElementById("share-qr-canvas");
    const codeBlock = document.getElementById("share-path");
    const codeValue = document.getElementById("share-code");

    if (
      !(frame instanceof HTMLElement)
      || !(canvas instanceof HTMLCanvasElement)
      || !(codeBlock instanceof HTMLElement)
      || !(codeValue instanceof HTMLElement)
    ) {
      return null;
    }

    const frameRect = frame.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const codeRect = codeBlock.getBoundingClientRect();
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;

    if (context) {
      const { width, height, data } = context.getImageData(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;

          if (
            data[index + 3] > 0
            && data[index] < 120
            && data[index + 1] < 120
            && data[index + 2] < 120
          ) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }
    }

    return {
      frameCenterX: frameRect.x + (frameRect.width / 2),
      frameCenterY: frameRect.y + (frameRect.height / 2),
      canvasCenterX: canvasRect.x + (canvasRect.width / 2),
      canvasCenterY: canvasRect.y + (canvasRect.height / 2),
      codeCenterX: codeRect.x + (codeRect.width / 2),
      codeTop: codeRect.top,
      frameBottom: frameRect.bottom,
      code: codeValue.textContent.trim(),
      contentBounds: maxX >= minX && maxY >= minY
        ? {
          left: minX,
          top: minY,
          right: canvas.width - maxX - 1,
          bottom: canvas.height - maxY - 1,
        }
        : null,
    };
  });

  expect(metrics).toBeTruthy();
  expect(metrics.contentBounds).toBeTruthy();
  expect(Math.abs(metrics.frameCenterX - metrics.canvasCenterX)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(metrics.frameCenterY - metrics.canvasCenterY)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(metrics.contentBounds.left - metrics.contentBounds.right)).toBeLessThanOrEqual(1);
  expect(Math.abs(metrics.contentBounds.top - metrics.contentBounds.bottom)).toBeLessThanOrEqual(1);
  expect(metrics.codeTop).toBeGreaterThan(metrics.frameBottom);
  expect(Math.abs(metrics.frameCenterX - metrics.codeCenterX)).toBeLessThanOrEqual(0.5);
  expect(metrics.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

  await page.locator(".share-panel").screenshot({
    path: path.join(OUTPUT_DIR, "teacher-share-qr.png"),
  });
});
