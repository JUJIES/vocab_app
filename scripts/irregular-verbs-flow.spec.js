const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4177";
const DEVICE_STORAGE_KEY = "dino-vocab-device-id-v1";
const SESSION_UNLOCK_KEY = "dino-vocab-session-unlocked-v1";
const TABLET_SESSION_STORAGE_KEY = "dino-vocab-tablet-session-v1";

test.use({
  viewport: { width: 1024, height: 768 },
  colorScheme: "dark",
  locale: "de-DE",
  hasTouch: true,
  deviceScaleFactor: 2,
});

function buildIrregularVerbSet() {
  return {
    set: {
      id: "irregular-verbs-test",
      title: "Irregular Verbs",
      revision: 1,
      languages: { source: "de", target: "en" },
      labels: { source: "Deutsch", target: "Englisch" },
    },
    cards: Array.from({ length: 3 }, (_, index) => ({
      id: `shine-${index + 1}`,
      source: { text: index === 0 ? "scheinen" : `scheinen ${index + 1}` },
      target: { text: "shine - shone - shone" },
      examples: [{
        id: "answer",
        source: index === 0 ? "scheinen" : `scheinen ${index + 1}`,
        target: "shine - shone - shone",
      }],
      hintData: {
        flashcard: {
          exampleId: "answer",
          maskedWord: "_____ - _____ - _____",
          firstLetterHint: "s____ - s____ - s____",
        },
      },
      acceptedAnswers: ["shine - shone - shone"],
    })),
  };
}

async function prepareStudentHome(page) {
  await page.route("**/sets/*.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildIrregularVerbSet()),
    });
  });

  await page.goto(new URL("/index.html", BASE_URL).toString(), { waitUntil: "networkidle" });
  await page.evaluate(async ({ deviceKey, sessionKey, tabletSessionKey }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    const tabletId = "rot-1";
    const response = await fetch(`/api/tablets/${encodeURIComponent(tabletId)}/verify-pin`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "1111" }),
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

async function openMode(page, modeKey, direction = "source-target") {
  await page.locator(".student-screen__library-card").first().click();
  await expect(page.locator("#launch-mode-modal")).toBeVisible();
  await page.locator(`button.launch-mode-modal__mode-card[data-mode-key="${modeKey}"]`).click();
  await page.locator("#launch-mode-start").click();
  await expect(page.locator("#launch-settings-modal")).toBeVisible();
  await page.locator(
    `[data-learning-direction-group="launch"] [data-learning-direction="${direction}"]`,
  ).click();
  await page.locator("#launch-settings-start").click();
}

test("irregular verb cards emphasize the infinitive and separate the other forms", async ({ page }) => {
  await prepareStudentHome(page);
  await openMode(page, "practice");

  await expect(page.locator("#front-word")).toHaveText("scheinen");
  const frontSize = await page.locator("#front-word").evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).fontSize),
  );
  await page.locator("#flashcard").click();
  await expect(page.locator("#back-word .irregular-verb-term__primary")).toHaveText("shine");
  const backPrimarySize = await page.locator("#back-word .irregular-verb-term__primary").evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(backPrimarySize).toBe(frontSize);
  const secondaryForms = page.locator("#back-word .irregular-verb-term__form");
  await expect(secondaryForms).toHaveCount(2);
  await expect(secondaryForms.nth(0).locator("small")).toHaveText("Simple Past");
  await expect(secondaryForms.nth(0).locator("span")).toHaveText("shone");
  await expect(secondaryForms.nth(1).locator("small")).toHaveText("Past Participle");
  await expect(secondaryForms.nth(1).locator("span")).toHaveText("shone");
  await expect(page.locator("#back-word")).not.toContainText("-");

  const geometry = await page.locator("#back-word").evaluate((word) => {
    const face = word.closest(".flashcard__face");
    const wordBounds = word.getBoundingClientRect();
    const faceBounds = face.getBoundingClientRect();
    return {
      insideHorizontally: wordBounds.left >= faceBounds.left && wordBounds.right <= faceBounds.right,
      insideVertically: wordBounds.top >= faceBounds.top && wordBounds.bottom <= faceBounds.bottom,
    };
  });
  expect(geometry.insideHorizontally).toBeTruthy();
  expect(geometry.insideVertically).toBeTruthy();
});

test("input mode asks all three forms separately and preserves correct fields during correction", async ({ page }) => {
  await prepareStudentHome(page);
  await openMode(page, "write");

  const verbFields = page.locator("[data-irregular-verb-input]");
  await expect(verbFields).toHaveCount(3);
  await expect(page.locator("#input-answer-field")).toBeHidden();
  await expect(page.locator("#input-answer-label")).toHaveText("Drei Verbformen");

  await verbFields.nth(0).fill("shine");
  await verbFields.nth(1).fill("shined");
  await verbFields.nth(2).fill("shone");
  await page.locator("#input-answer-form").press("Enter");

  await expect(page.locator("#input-feedback-title")).toHaveText("Noch nicht korrekt");
  await expect(verbFields.nth(0)).toHaveValue("shine");
  await expect(verbFields.nth(1)).toHaveValue("");
  await expect(verbFields.nth(2)).toHaveValue("shone");

  await verbFields.nth(1).fill("shone");
  await page.locator("#input-answer-form").press("Enter");
  await expect(page.locator("#input-feedback-title")).toHaveText("Korrigiert");
});

test("Enter advances through verb fields and correction offers an explicit solution", async ({ page }) => {
  await prepareStudentHome(page);
  await openMode(page, "write");

  const verbFields = page.locator("[data-irregular-verb-input]");
  await verbFields.nth(0).fill("shine");
  await verbFields.nth(0).press("Enter");
  await expect(verbFields.nth(1)).toBeFocused();
  await expect(page.locator("#input-feedback")).toHaveAttribute("aria-hidden", "true");

  await verbFields.nth(1).fill("shined");
  await verbFields.nth(1).press("Enter");
  await expect(verbFields.nth(2)).toBeFocused();
  await expect(page.locator("#input-feedback")).toHaveAttribute("aria-hidden", "true");

  await verbFields.nth(2).fill("shone");
  await verbFields.nth(2).press("Enter");
  await expect(page.locator("#input-feedback-title")).toHaveText("Noch nicht korrekt");
  await expect(page.locator("#input-reveal-answer")).toBeVisible();
  await expect(page.locator("#input-feedback-correct-row")).toBeHidden();

  await page.locator("#input-reveal-answer").click();
  await expect(page.locator("#input-feedback-correct-row")).toBeVisible();
  await expect(page.locator("#input-feedback-correct")).toHaveText("shine · shone · shone");
  await expect(verbFields.nth(1)).toBeFocused();
  await expect(page.locator("#input-reveal-answer")).toBeHidden();
});

test("tablet portrait keeps all verb inputs and correction help usable", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await prepareStudentHome(page);
  await openMode(page, "write");

  const verbFields = page.locator("[data-irregular-verb-input]");
  const responsePane = page.locator(".input-stage__response-pane");
  await expect(verbFields).toHaveCount(3);

  for (const field of await verbFields.all()) {
    await expect(field).toBeInViewport();
  }

  await verbFields.nth(0).fill("shine");
  await verbFields.nth(1).fill("shined");
  await verbFields.nth(2).fill("shone");
  await page.locator("#input-check-button").tap();

  const revealButton = page.locator("#input-reveal-answer");
  await expect(revealButton).toBeVisible();
  await expect(revealButton).toBeInViewport();
  await revealButton.tap();
  await expect(page.locator("#input-feedback-correct-row")).toBeVisible();
  await expect(page.locator("#input-feedback-correct-row")).toBeInViewport();

  const responseBounds = await responsePane.boundingBox();
  const feedbackBounds = await page.locator("#input-feedback").boundingBox();
  expect(responseBounds).not.toBeNull();
  expect(feedbackBounds).not.toBeNull();
  expect(feedbackBounds.x).toBeGreaterThanOrEqual(responseBounds.x);
  expect(feedbackBounds.x + feedbackBounds.width).toBeLessThanOrEqual(
    responseBounds.x + responseBounds.width,
  );
});

test("reverse input direction shows the three forms as a structured prompt", async ({ page }) => {
  await prepareStudentHome(page);
  await openMode(page, "write", "target-source");

  await expect(page.locator("#input-prompt-word .irregular-verb-term__primary")).toHaveText("shine");
  await expect(page.locator("#input-prompt-word .irregular-verb-term__form")).toHaveCount(2);
  await expect(page.locator("#input-answer-field")).toBeVisible();
  await expect(page.locator("#input-verb-answer-fields")).toBeHidden();
});
