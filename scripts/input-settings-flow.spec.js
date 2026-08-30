const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const DEVICE_STORAGE_KEY = "dino-vocab-device-id-v1";
const SESSION_UNLOCK_KEY = "dino-vocab-session-unlocked-v1";
const TABLET_SESSION_STORAGE_KEY = "dino-vocab-tablet-session-v1";

test.use({
  viewport: { width: 820, height: 1180 },
  colorScheme: "dark",
  locale: "de-DE",
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
  await expect(page.locator(".student-screen__library-card").first()).toBeVisible();
  await page.locator(".student-screen__library-card").first().click();
  await expect(page.locator("#launch-mode-modal")).toBeVisible();
  await page.locator('button.launch-mode-modal__mode-card[data-mode-key="write"]').click();

  const setResponsePromise = page.waitForResponse((response) => (
    response.request().method() === "GET"
      && response.url().includes("/sets/")
      && response.url().endsWith(".json")
  ));

  await page.locator("#launch-mode-start").click();
  await expect(page.locator("#launch-direction-modal")).toBeVisible();
  await page.locator('[data-learning-direction-group="launch"] [data-learning-direction="source-target"]').click();
  const setResponse = await setResponsePromise;
  const setData = await setResponse.json();

  await expect(page.locator("#input-stage")).toBeVisible();
  await expect(page.locator("#input-answer-field")).toBeVisible();
  return setData;
}

async function setSliderValue(page, selector, value) {
  await page.locator(selector).evaluate((element, nextValue) => {
    element.value = String(nextValue);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function setSwitchValue(page, selector, checked) {
  await page.locator(selector).evaluate((element, nextChecked) => {
    element.checked = Boolean(nextChecked);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, checked);
}

async function selectDelayType(page, delayType) {
  const selector = delayType === "wrong"
    ? "#input-delay-type-wrong"
    : "#input-delay-type-correct";
  await page.locator(selector).click();
}

test("input settings apply immediately during correction flow", async ({ page }) => {
  const setData = await prepareInputMode(page);

  expect(Array.isArray(setData.cards)).toBeTruthy();
  expect(setData.cards.length).toBeGreaterThanOrEqual(3);

  const firstCard = setData.cards[0];
  const secondCard = setData.cards[1];
  const thirdCard = setData.cards[2];

  const settingsButton = page.locator("#input-settings-button");
  const popover = page.locator("#input-settings-popover");
  const promptWord = page.locator("#input-prompt-word");
  const answerField = page.locator("#input-answer-field");
  const feedbackTitle = page.locator("#input-feedback-title");

  await settingsButton.click();
  await expect(settingsButton).toHaveAttribute("aria-expanded", "true");
  await expect(popover).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator('[data-learning-direction-group="input"] [data-learning-direction="source-target"]')).toContainText("→");
  await page.locator('[data-learning-direction-group="input"] [data-learning-direction="target-source"]').click();
  await expect(promptWord).toHaveText(firstCard.target.text.trim());

  await settingsButton.click();
  await page.locator('[data-learning-direction-group="input"] [data-learning-direction="source-target"]').click();
  await expect(promptWord).toHaveText(firstCard.source.text.trim());

  await settingsButton.click();
  await expect(popover).toHaveAttribute("aria-hidden", "false");

  await setSwitchValue(page, "#input-correction-toggle", true);
  await selectDelayType(page, "correct");
  await setSliderValue(page, "#input-delay-slider", 0);
  await selectDelayType(page, "wrong");
  await setSliderValue(page, "#input-delay-slider", 0);

  await answerField.fill("falschtest");
  await page.locator("#input-answer-form").press("Enter");
  await expect(feedbackTitle).toHaveText("Noch nicht korrekt");
  await expect(answerField).toBeEnabled();
  await expect(promptWord).toHaveText(firstCard.source.text.trim());

  await page.mouse.click(16, 16);
  await expect(settingsButton).toHaveAttribute("aria-expanded", "false");

  await settingsButton.click();
  await setSwitchValue(page, "#input-correction-toggle", false);
  await expect(promptWord).toHaveText(secondCard.source.text.trim(), { timeout: 3000 });

  await setSwitchValue(page, "#input-correction-toggle", true);
  await answerField.fill("nochmal falsch");
  await page.locator("#input-answer-form").press("Enter");
  await expect(feedbackTitle).toHaveText("Noch nicht korrekt");

  await answerField.fill(secondCard.target.text.trim());
  await page.locator("#input-answer-form").press("Enter");
  await expect(promptWord).toHaveText(thirdCard.source.text.trim(), { timeout: 3000 });
});
