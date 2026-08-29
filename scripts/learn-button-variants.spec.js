const fs = require("fs/promises");
const path = require("path");
const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const ROUND_NAME = process.env.ROUND_NAME || "final-single";
const OUTPUT_DIR = process.env.SCREENSHOT_DIR
  || path.join(process.cwd(), "artifacts", "learn-button-variants", ROUND_NAME);
const DEVICE_STORAGE_KEY = "dino-vocab-device-id-v1";
const SESSION_UNLOCK_KEY = "dino-vocab-session-unlocked-v1";
const TABLET_SESSION_STORAGE_KEY = "dino-vocab-tablet-session-v1";

test.use({
  viewport: { width: 1366, height: 1024 },
  colorScheme: "dark",
  locale: "de-DE",
});

test.beforeAll(async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
});

async function preparePage(page) {
  await page.goto(new URL("/index.html", BASE_URL).toString(), { waitUntil: "networkidle" });
  await page.evaluate(async ({ deviceKey, sessionKey, tabletSessionKey }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    const tabletId = "rot-1";
    const pin = "1111";

    await fetch("/api/access-session", {
      credentials: "same-origin",
    });

    const response = await fetch(`/api/tablets/${encodeURIComponent(tabletId)}/verify-pin`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pin }),
    });

    const data = await response.json();

    if (!response.ok || !data?.session?.token) {
      throw new Error(`Unable to prepare tablet session: ${response.status}`);
    }

    window.localStorage.setItem(deviceKey, tabletId);
    window.sessionStorage.setItem(sessionKey, "1");
    window.sessionStorage.setItem(tabletSessionKey, JSON.stringify({
      tabletId,
      token: data.session.token,
    }));
  }, {
    deviceKey: DEVICE_STORAGE_KEY,
    sessionKey: SESSION_UNLOCK_KEY,
    tabletSessionKey: TABLET_SESSION_STORAGE_KEY,
  });

  await page.goto(new URL("/index.html", BASE_URL).toString(), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts?.ready || Promise.resolve());
  await expect(page.locator(".student-screen__library-card").first()).toBeVisible();
  await page.waitForTimeout(250);
}

test("capture final learn button card", async ({ page }) => {
  await preparePage(page);

  await page.locator(".student-screen__library-card").first().screenshot({
    path: path.join(OUTPUT_DIR, "final-button-card.png"),
  });
});
