const fs = require("fs/promises");
const path = require("path");
const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const OUTPUT_DIR = process.env.SCREENSHOT_DIR
  || path.join(process.cwd(), "artifacts", "student-home-tablet-header");
const DEVICE_STORAGE_KEY = "dino-vocab-device-id-v1";
const SESSION_UNLOCK_KEY = "dino-vocab-session-unlocked-v1";
const TABLET_SESSION_STORAGE_KEY = "dino-vocab-tablet-session-v1";

test.use({
  viewport: { width: 900, height: 700 },
  colorScheme: "dark",
  locale: "de-DE",
});

test.beforeAll(async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
});

async function prepareHome(page) {
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
  await expect(page.locator("#student-screen-title")).toContainText("Lerndeck");
  await expect(page.locator(".student-screen__home-actions")).toBeVisible();
  await page.waitForTimeout(300);
}

const VIEWPORTS = [
  { name: "1024w", width: 1024, height: 768 },
  { name: "900w", width: 900, height: 700 },
  { name: "820w", width: 820, height: 700 },
  { name: "768w", width: 768, height: 700 },
];

for (const viewport of VIEWPORTS) {
  test(`capture student home header on tablet (${viewport.name})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await prepareHome(page);

    const selectors = {
      actions: ".student-screen__home-actions",
      context: ".student-screen__home-context",
      divider: ".student-screen__home-divider--actions",
      logout: ".student-screen__home-actions .student-screen__home-logout",
      pill: ".device-pill--home-meta",
    };

    const boxes = {};
    for (const [key, selector] of Object.entries(selectors)) {
      boxes[key] = await page.locator(selector).boundingBox();
    }

    await testInfo.attach(`student-home-tablet-header-boxes-${viewport.name}`, {
      body: JSON.stringify(boxes, null, 2),
      contentType: "application/json",
    });

    await fs.writeFile(
      path.join(OUTPUT_DIR, `student-home-tablet-header-boxes-${viewport.name}.json`),
      JSON.stringify(boxes, null, 2),
      "utf8",
    );

    await page.locator(".student-screen__header").screenshot({
      path: path.join(OUTPUT_DIR, `student-home-tablet-header-full-${viewport.name}.png`),
    });

    await page.locator(".student-screen__home-actions").screenshot({
      path: path.join(OUTPUT_DIR, `student-home-tablet-header-${viewport.name}.png`),
    });
  });
}
