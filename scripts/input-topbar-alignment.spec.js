const fs = require("fs/promises");
const path = require("path");
const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const OUTPUT_DIR = process.env.SCREENSHOT_DIR
  || path.join(process.cwd(), "artifacts", "input-topbar-alignment");
const DEVICE_STORAGE_KEY = "dino-vocab-device-id-v1";
const SESSION_UNLOCK_KEY = "dino-vocab-session-unlocked-v1";
const TABLET_SESSION_STORAGE_KEY = "dino-vocab-tablet-session-v1";

test.use({
  viewport: { width: 1213, height: 340 },
  colorScheme: "dark",
  locale: "de-DE",
});

test.beforeAll(async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
});

async function prepareInputMode(page) {
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
  await page.locator(".student-screen__library-card").first().click();
  await expect(page.locator("#launch-mode-modal")).toBeVisible();
  await page.locator('button.launch-mode-modal__mode-card[data-mode-key="write"]').click();
  await page.locator("#launch-mode-start").click();
  await expect(page.locator("#launch-settings-modal")).toBeVisible();
  await page.locator('[data-learning-direction-group="launch"] [data-learning-direction="source-target"]').click();
  await page.locator("#launch-settings-start").click();
  await expect(page.locator("#input-stage")).toBeVisible();
  await expect(page.locator("#input-answer-field")).toBeVisible();
  await page.waitForTimeout(250);
}

test("capture aligned input topbar", async ({ page }, testInfo) => {
  await prepareInputMode(page);

  const selectors = {
    topbar: ".input-stage__menu",
    back: "#input-home-link",
    progress: "#input-progress-shell .progress-row",
    settings: "#input-settings-button",
    logout: ".input-stage__menu-logout",
    bar: "#input-progress-shell .progress-bar",
  };

  const boxes = {};
  for (const [key, selector] of Object.entries(selectors)) {
    boxes[key] = await page.locator(selector).boundingBox();
  }

  await testInfo.attach("input-topbar-boxes", {
    body: JSON.stringify(boxes, null, 2),
    contentType: "application/json",
  });

  await fs.writeFile(
    path.join(OUTPUT_DIR, "input-topbar-boxes.json"),
    JSON.stringify(boxes, null, 2),
    "utf8",
  );

  await page.locator(".input-stage__menu").screenshot({
    path: path.join(OUTPUT_DIR, "input-topbar.png"),
  });
});
