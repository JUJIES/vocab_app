const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const DEVICE_STORAGE_KEY = "dino-vocab-device-id-v1";
const SESSION_UNLOCK_KEY = "dino-vocab-session-unlocked-v1";
const TABLET_SESSION_STORAGE_KEY = "dino-vocab-tablet-session-v1";

test.use({
  viewport: { width: 1213, height: 640 },
  colorScheme: "dark",
  locale: "de-DE",
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
}

test("launch mode start button keeps width stable and flips between differently styled faces", async ({ page }) => {
  await preparePage(page);

  await page.locator(".student-screen__library-card").first().click();
  await expect(page.locator("#launch-mode-modal")).toBeVisible();
  await page.waitForTimeout(360);

  const initialButtonWidth = await page.locator("#launch-mode-start").evaluate((node) => node.getBoundingClientRect().width);

  await page.locator('button.launch-mode-modal__mode-card[data-mode-key="write"]').click();
  await page.waitForTimeout(80);

  const transitionSnapshot = await page.evaluate(() => {
    const button = document.getElementById("launch-mode-start");
    const stage = document.getElementById("launch-mode-start-stage");
    const faces = [...stage.querySelectorAll(".launch-mode-modal__action-content")].map((node) => {
      const style = getComputedStyle(node);
      return {
        modeKey: node.dataset.modeKey || "",
        className: node.className,
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor,
      };
    });

    return {
      buttonWidth: button.getBoundingClientRect().width,
      faces,
    };
  });

  expect(Math.abs(transitionSnapshot.buttonWidth - initialButtonWidth)).toBeLessThanOrEqual(1);
  expect(transitionSnapshot.faces.length).toBeGreaterThan(1);

  const uniqueFaceStyles = new Set(
    transitionSnapshot.faces.map((face) => `${face.backgroundImage}|${face.backgroundColor}`),
  );
  expect(uniqueFaceStyles.size).toBeGreaterThan(1);
});
