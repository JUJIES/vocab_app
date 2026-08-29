const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const TEST_TABLET_ID = "blau-2";
const TEST_TABLET_PIN = "1111";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 1366, height: 1024 },
  colorScheme: "dark",
  locale: "de-DE",
});

async function prepareHome(page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.goto("/index.html", { waitUntil: "networkidle" });
  await expect(page.locator("#student-screen-title")).toContainText("Lerndeck");
  await page.getByRole("button", { name: /Weiterlernen/i }).click();
  await page.locator('select[name="tabletId"]').selectOption(TEST_TABLET_ID);
  await page.locator('input[name="pin-entry"]').fill(TEST_TABLET_PIN);
  await page.locator('.student-screen__access-form--login button[type="submit"]').click();
  await expect(page.locator(".student-screen__library-menu-toggle").first()).toBeVisible();
}

async function openShareModal(page) {
  await page.locator(".student-screen__library-menu-toggle").first().click();
  await page.getByRole("button", { name: "Teilen" }).click();
  await expect(page.locator("#student-set-modal")).toBeVisible();
  await page.waitForTimeout(150);
}

async function readQrMetrics(page) {
  return page.evaluate(() => {
    const modal = document.getElementById("student-set-modal");
    const panel = modal?.querySelector(".student-set-panel");
    const shell = modal?.querySelector(".student-share__qr-shell");
    const frame = modal?.querySelector(".student-share__qr-frame");
    const canvas = modal?.querySelector(".student-share__qr");

    if (
      !(panel instanceof HTMLElement)
      || !(shell instanceof HTMLElement)
      || !(frame instanceof HTMLElement)
      || !(canvas instanceof HTMLCanvasElement)
    ) {
      return null;
    }

    const panelRect = panel.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
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
      panelWidth: panelRect.width,
      shellWidth: shellRect.width,
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

test("student set share modal keeps QR shell compact and stable", async ({ page }) => {
  await prepareHome(page);

  await openShareModal(page);
  const first = await readQrMetrics(page);

  expect(first).toBeTruthy();
  expect(first.panelWidth).toBeGreaterThan(420);
  expect(first.shellWidth).toBeLessThan(first.panelWidth - 80);
  expect(first.frameWidth).toBeGreaterThan(240);
  expect(first.frameHeight).toBeGreaterThan(240);
  expect(first.canvasWidth).toBeGreaterThan(240);
  expect(first.canvasHeight).toBeGreaterThan(240);
  expect(first.contentBounds).toBeTruthy();
  expect(first.contentBounds.width).toBeGreaterThan(210);
  expect(Math.abs(first.contentBounds.left - first.contentBounds.right)).toBeLessThanOrEqual(1);
  expect(Math.abs(first.contentBounds.top - first.contentBounds.bottom)).toBeLessThanOrEqual(1);

  await page.keyboard.press("Escape");
  await expect(page.locator("#student-set-modal")).toBeHidden();

  await openShareModal(page);
  const second = await readQrMetrics(page);

  expect(second).toBeTruthy();
  expect(Math.abs(second.shellWidth - first.shellWidth)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(second.frameWidth - first.frameWidth)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(second.frameHeight - first.frameHeight)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(second.canvasWidth - first.canvasWidth)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(second.canvasHeight - first.canvasHeight)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(second.bitmapWidth - first.bitmapWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.bitmapHeight - first.bitmapHeight)).toBeLessThanOrEqual(1);
  expect(second.contentBounds).toBeTruthy();
  expect(Math.abs(second.contentBounds.width - first.contentBounds.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.contentBounds.height - first.contentBounds.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.contentBounds.left - second.contentBounds.right)).toBeLessThanOrEqual(1);
  expect(Math.abs(second.contentBounds.top - second.contentBounds.bottom)).toBeLessThanOrEqual(1);
});
