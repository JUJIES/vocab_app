const fs = require("fs/promises");
const path = require("path");
const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const OUTPUT_DIR = process.env.SCREENSHOT_DIR
  || path.join(process.cwd(), "artifacts", "student-home-tablet-header");
const DEVICE_STORAGE_KEY = "dino-vocab-device-id-v1";
const SESSION_UNLOCK_KEY = "dino-vocab-session-unlocked-v1";
const TABLET_SESSION_STORAGE_KEY = "dino-vocab-tablet-session-v1";
const TEST_TABLET_ID = "rot-1";
const TEST_TABLET_PIN = "4177";
const TEACHER_ID = process.env.TEACHER_ID || "julius";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 900, height: 700 },
  colorScheme: "dark",
  locale: "de-DE",
});

test.beforeAll(async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
});

test.afterEach(async ({ request }) => {
  await request.post(`/api/tablets/${encodeURIComponent(TEST_TABLET_ID)}/decouple`);
});

async function prepareHome(page, request) {
  const teacherLogin = await request.post("/api/teacher/session", {
    data: { teacherId: TEACHER_ID, password: TEACHER_PASSWORD },
  });
  expect(teacherLogin.ok()).toBeTruthy();

  await request.post(`/api/tablets/${encodeURIComponent(TEST_TABLET_ID)}/decouple`);
  const registration = await request.post(`/api/tablets/${encodeURIComponent(TEST_TABLET_ID)}/register`, {
    data: { pin: TEST_TABLET_PIN },
  });
  expect(registration.ok()).toBeTruthy();

  await page.goto(new URL("/index.html", BASE_URL).toString(), { waitUntil: "networkidle" });
  await page.evaluate(async ({ deviceKey, sessionKey, tabletSessionKey, tabletId, pin }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();

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
    tabletId: TEST_TABLET_ID,
    pin: TEST_TABLET_PIN,
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
  { name: "390w", width: 390, height: 760 },
];

for (const viewport of VIEWPORTS) {
  test(`student home header stays stable (${viewport.name})`, async ({ page, request }, testInfo) => {
    test.skip(!TEACHER_PASSWORD, "TEACHER_PASSWORD fehlt für den isolierten Tablet-Test.");
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await prepareHome(page, request);

    const selectors = {
      actions: ".student-screen__home-actions",
      context: ".student-screen__home-context",
      divider: ".student-screen__home-divider--actions",
      header: ".student-screen__header",
      logout: ".student-screen__home-actions .student-screen__home-logout",
      pill: ".device-pill--home-meta",
      title: "#student-screen-title",
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

    expect(await page.locator(".student-screen__home-summary").count()).toBe(0);
    expect(boxes.header.x).toBeGreaterThanOrEqual(0);
    expect(boxes.header.x + boxes.header.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(boxes.actions.width).toBeLessThan(240);

    if (viewport.width > 620) {
      expect(boxes.actions.x).toBeGreaterThanOrEqual(boxes.title.x + boxes.title.width);
      expect(Math.abs(
        (boxes.actions.y + boxes.actions.height / 2)
        - (boxes.title.y + boxes.title.height / 2),
      )).toBeLessThan(8);
    } else {
      expect(boxes.actions.y).toBeGreaterThanOrEqual(boxes.title.y + boxes.title.height);
      expect(boxes.actions.x).toBeLessThan(boxes.title.x + 8);
    }

    await page.locator(".student-screen__header").screenshot({
      path: path.join(OUTPUT_DIR, `student-home-tablet-header-full-${viewport.name}.png`),
    });

    await page.locator(".student-screen__home-actions").screenshot({
      path: path.join(OUTPUT_DIR, `student-home-tablet-header-${viewport.name}.png`),
    });
  });
}
