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

    let response = await fetch(`/api/tablets/${encodeURIComponent(tabletId)}/verify-pin`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pin }),
    });

    let data = await response.json();
    if (response.status === 409) {
      response = await fetch(`/api/tablets/${tabletId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      data = await response.json();
    }

    if (!response.ok || !data?.session?.token) {
      throw new Error(`Unable to prepare tablet session: ${response.status}`);
    }

    const subscription = await fetch(`/api/tablets/${tabletId}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${data.session.token}`,
      },
      body: JSON.stringify({ setPath: "sets/food-basics-01.json" }),
    });
    if (!subscription.ok) throw new Error(`Unable to prepare subscription: ${subscription.status}`);

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

test("new deck stays clean and launch mode button flips without resizing", async ({ page }, testInfo) => {
  await preparePage(page);

  const deck = page.locator(".student-screen__library-card").first();
  await expect(deck).not.toContainText("Bereit zum Starten");
  await expect(deck.locator(".student-screen__library-stat-band")).toHaveCount(0);
  await deck.screenshot({ path: testInfo.outputPath("clean-new-deck.png") });

  await deck.click();
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

test("all learning modes share one extensible settings dialog", async ({ page }, testInfo) => {
  await preparePage(page);
  await page.locator(".student-screen__library-card").first().click();

  await page.locator('.launch-mode-modal__mode-card[data-mode-key="practice"]').click();
  await page.locator("#launch-mode-start").click();
  await expect(page.locator("#launch-settings-title")).toHaveText("Übungseinstellungen");
  await expect(page.locator('[data-learning-direction-group="launch"]')).toBeVisible();
  await expect(page.locator("#launch-settings-additional")).toBeHidden();
  await expect(page.locator("#launch-settings-start-label")).toHaveText("Üben starten");
  await page.waitForTimeout(300);
  await page.locator("#launch-settings-panel").screenshot({ path: testInfo.outputPath("practice-settings.png") });

  await page.locator("#launch-settings-back").click();
  await page.locator('.launch-mode-modal__mode-card[data-mode-key="write"]').click();
  await page.locator("#launch-mode-start").click();
  await expect(page.locator("#launch-settings-title")).toHaveText("Eingabeeinstellungen");
  await expect(page.locator("#launch-settings-additional")).toBeHidden();
  await expect(page.locator("#launch-settings-start-label")).toHaveText("Eingabe starten");

  await page.locator("#launch-settings-back").click();
  await page.locator('.launch-mode-modal__mode-card[data-mode-key="test"]').click();
  await page.locator("#launch-mode-start").click();
  await expect(page.locator("#launch-settings-title")).toHaveText("Testeinstellungen");
  await expect(page.locator("#launch-settings-additional")).toBeVisible();
  await expect(page.locator(".launch-mode-modal__test-count-slider")).toBeVisible();
  await expect(page.locator("#launch-settings-start-label")).toHaveText("Testen starten");
  await page.waitForTimeout(300);
  await page.locator("#launch-settings-panel").screenshot({ path: testInfo.outputPath("test-settings.png") });

  await page.locator('[data-learning-direction-group="launch"] [data-learning-direction="target-source"]').click();
  await expect(page.locator("#launch-settings-modal")).toBeVisible();
  await expect(page.locator('[data-learning-direction-group="launch"] [data-learning-direction="target-source"]')).toHaveClass(/is-selected/);

  await page.setViewportSize({ width: 390, height: 844 });
  const compactGeometry = await page.locator("#launch-settings-panel").evaluate((panel) => ({
    fitsWidth: panel.getBoundingClientRect().right <= window.innerWidth && panel.getBoundingClientRect().left >= 0,
    noHorizontalOverflow: panel.scrollWidth <= panel.clientWidth,
    startVisible: panel.querySelector("#launch-settings-start").getBoundingClientRect().bottom <= window.innerHeight,
  }));
  expect(compactGeometry).toEqual({ fitsWidth: true, noHorizontalOverflow: true, startVisible: true });
});

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 744, height: 1133 },
  { width: 390, height: 844 },
]) {
  test(`mode cards keep labels and round counts separate at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await preparePage(page);
    await page.locator(".student-screen__library-card").first().click();
    await expect(page.locator("#launch-mode-modal")).toBeVisible();
    await page.waitForTimeout(400);
    await page.locator("#launch-mode-title").evaluate((node) => { node.textContent = "Means of transport"; });

    const cards = page.locator(".launch-mode-modal__mode-card");
    await expect(cards).toHaveCount(3);
    await expect(page.locator("#launch-mode-modal")).not.toContainText(/Ø Score|Ø \d/);
    // The distribution indicator has separate, visually hidden percentage labels.
    await expect(page.locator(".launch-mode-modal__modes")).not.toContainText("%");
    await expect(cards.first().locator(".launch-mode-modal__mode-summary")).toHaveText("0Durchgänge");
    // Exercise a longer count as well: numeric columns must not assume two digits.
    await cards.last().locator(".launch-mode-modal__summary-value").evaluate((node) => { node.textContent = "1234"; });
    for (const card of await cards.all()) {
      const geometry = await card.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        const label = node.querySelector(".launch-mode-modal__mode-leading").getBoundingClientRect();
        const summary = node.querySelector(".launch-mode-modal__mode-summary").getBoundingClientRect();
        return {
          separated: label.bottom < summary.top,
          contained: [label, summary].every((rect) => rect.left >= bounds.left && rect.right <= bounds.right && rect.bottom <= bounds.bottom),
          noOverflow: node.scrollWidth <= node.clientWidth,
        };
      });
      expect(geometry).toEqual({ separated: true, contained: true, noOverflow: true });
    }
    await page.screenshot({ path: testInfo.outputPath("mode-selection.png"), fullPage: true });
    for (const mode of ["write", "test"]) {
      await page.locator(`.launch-mode-modal__mode-card[data-mode-key="${mode}"]`).click();
      await page.waitForTimeout(400);
      await expect(page.locator("#launch-mode-start")).toBeInViewport();
    }
  });
}
