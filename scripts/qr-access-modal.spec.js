const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 1024, height: 900 },
  colorScheme: "dark",
  locale: "de-DE",
});

async function readQrMetrics(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById("student-share-qr");
    const frame = canvas?.closest(".student-share__qr-frame");
    const modal = document.querySelector(".app-shell[data-app-mode=\"access\"] .student-share__modal");

    if (!(canvas instanceof HTMLCanvasElement) || !(frame instanceof HTMLElement)) {
      return null;
    }

    const frameRect = frame.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const modalRect = modal instanceof HTMLElement ? modal.getBoundingClientRect() : null;
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
          const alpha = data[index + 3];
          const red = data[index];
          const green = data[index + 1];
          const blue = data[index + 2];

          if (alpha > 0 && red < 120 && green < 120 && blue < 120) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }
    }

    return {
      modalWidth: modalRect?.width || 0,
      modalHeight: modalRect?.height || 0,
      frameWidth: frameRect.width,
      frameHeight: frameRect.height,
      canvasWidth: canvasRect.width,
      canvasHeight: canvasRect.height,
      bitmapWidth: canvas.width,
      bitmapHeight: canvas.height,
      contentBounds: maxX >= minX && maxY >= minY
        ? {
          left: minX,
          top: minY,
          right: canvas.width - maxX - 1,
          bottom: canvas.height - maxY - 1,
          width: (maxX - minX) + 1,
          height: (maxY - minY) + 1,
        }
        : null,
    };
  });
}

test("access QR modal stays stable across repeated openings", async ({ page }) => {
  await page.goto("/index.html", { waitUntil: "networkidle" });
  const qrToggle = page.getByRole("button", { name: "QR-Code anzeigen" });
  await expect(qrToggle).toBeVisible();
  await expect(page.locator("#student-screen-title")).toContainText("Lerndeck");

  await qrToggle.click();
  await expect(page.locator("#student-share-block")).toBeVisible();
  await page.waitForTimeout(150);
  const first = await readQrMetrics(page);

  expect(first).toBeTruthy();
  expect(first.modalWidth).toBeGreaterThan(390);
  expect(first.modalHeight).toBeGreaterThan(530);
  expect(first.frameWidth).toBeGreaterThan(270);
  expect(first.canvasWidth).toBeGreaterThan(260);
  expect(first.contentBounds).toBeTruthy();
  expect(first.contentBounds.width).toBeGreaterThan(230);
  expect(Math.abs(first.contentBounds.left - first.contentBounds.right)).toBeLessThanOrEqual(1);
  expect(Math.abs(first.contentBounds.top - first.contentBounds.bottom)).toBeLessThanOrEqual(1);

  await page.keyboard.press("Escape");
  await expect(page.locator("#student-share-block")).toBeHidden();

  await qrToggle.click();
  await expect(page.locator("#student-share-block")).toBeVisible();
  await page.waitForTimeout(150);
  const second = await readQrMetrics(page);

  expect(second).toBeTruthy();
  expect(Math.abs(second.modalWidth - first.modalWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.modalHeight - first.modalHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.frameWidth - first.frameWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.frameHeight - first.frameHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.canvasWidth - first.canvasWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.canvasHeight - first.canvasHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.bitmapWidth - first.bitmapWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.bitmapHeight - first.bitmapHeight)).toBeLessThanOrEqual(1);
  expect(second.contentBounds).toBeTruthy();
  expect(Math.abs(second.contentBounds.width - first.contentBounds.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.contentBounds.height - first.contentBounds.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.contentBounds.left - second.contentBounds.right)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.contentBounds.top - second.contentBounds.bottom)).toBeLessThanOrEqual(1);
});
