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
  await page.evaluate(async () => {
    Math.random = () => 0.5;
    await (document.fonts?.ready || Promise.resolve());
  });
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
  await expect(page.locator("#input-check-button")).toHaveText("Antwort prüfen");
  await expect(page.locator("#input-feedback")).toHaveAttribute("aria-hidden", "true");

  const collapsedCardHeight = await page.locator("#input-answer-card").evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  const compactLayout = await page.locator("#input-answer-card").evaluate((card) => {
    const fields = card.querySelector("#input-verb-answer-fields").getBoundingClientRect();
    const button = card.querySelector("#input-check-button").getBoundingClientRect();
    return {
      buttonBelowFields: button.top > fields.bottom,
      alignedLeft: Math.abs(button.left - fields.left) < 1,
      equalWidth: Math.abs(button.width - fields.width) < 1,
    };
  });
  expect(compactLayout).toEqual({
    buttonBelowFields: true,
    alignedLeft: true,
    equalWidth: true,
  });

  await verbFields.nth(0).fill("to shine");
  await verbFields.nth(1).fill("shined");
  await verbFields.nth(2).fill("shone");
  await page.locator("#input-answer-form").press("Enter");

  await expect(page.locator("#input-feedback-title")).toHaveText("Markierte Antwort verbessern.");
  await expect(page.locator("#input-check-button")).toHaveText("Korrektur prüfen");
  await expect(verbFields.nth(0)).toHaveValue("to shine");
  await expect(verbFields.nth(1)).toHaveValue("shined");
  await expect(verbFields.nth(2)).toHaveValue("shone");
  await expect.poll(() => page.locator("#input-answer-card").evaluate(
    (element) => element.getBoundingClientRect().height,
  )).toBeGreaterThan(collapsedCardHeight + 20);

  await verbFields.nth(1).fill("shone");
  await page.locator("#input-answer-form").press("Enter");
  await expect(page.locator("#input-check-button")).toHaveText("Korrigiert");
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
  await expect(page.locator("#input-feedback-title")).toHaveText("Markierte Antwort verbessern.");
  await expect(page.locator("#input-reveal-answer")).toBeVisible();
  await expect(page.locator("#input-feedback-correct-row")).toBeHidden();

  await page.locator("#input-reveal-answer").click();
  await expect(page.locator("#input-feedback-correct-row")).toBeVisible();
  await expect(page.locator("#input-feedback-correct")).toHaveText("Simple Past: shone");
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

for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
  for (const irregular of [false, true]) {
    test(`${irregular ? "verb" : "single"} feedback preserves the attempt and guides correction at ${viewport.width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await prepareStudentHome(page);
      if (!irregular) {
        const set = buildIrregularVerbSet();
        for (const card of set.cards) {
          card.target.text = "shine";
          card.acceptedAnswers = ["shine"];
        }
        await page.route("**/sets/*.json", (route) => route.fulfill({ json: set }));
      }
      await openMode(page, "write");
      await expect(page.locator("#launch-settings-modal")).toBeHidden();
      const fields = irregular ? page.locator("[data-irregular-verb-input]") : page.locator("#input-answer-field");
      const button = page.locator("#input-check-button");
      const feedback = page.locator("#input-feedback");
      const target = irregular ? fields.nth(1) : fields.first();
      const capture = async (name) => {
        await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
      };
      await expect(feedback).toBeHidden();
      if (irregular) {
        await fields.nth(0).fill("shine");
        await fields.nth(2).fill("shone");
      }
      await target.fill(irregular ? "shined" : "shiny");
      await button.tap();
      const firstAttemptPoints = await page.evaluate(() => state.inputSession.awardedPointsForCurrentCard);
      await expect(target).toHaveValue(irregular ? "shined" : "shiny");
      await expect(target).toBeFocused();
      await expect(target).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator("#input-feedback-input")).toHaveCount(0);
      if (irregular) await expect(fields.nth(0)).toHaveAttribute("readonly", "");
      await expect(page.locator("#input-reveal-answer")).toBeInViewport();
      await page.waitForTimeout(300);
      await capture("wrong");
      await page.locator("#input-reveal-answer").tap();
      await expect(page.locator("#input-feedback-correct")).toHaveText(irregular ? "Simple Past: shone" : "shine");
      await expect(target).toBeFocused();
      await target.fill(irregular ? "shone" : "shine");
      await expect(target).toHaveAttribute("aria-invalid", "false");
      await target.press("Enter");
      await expect(button).toHaveText("Korrigiert");
      await expect(button).toBeDisabled();
      await expect(feedback).toHaveAttribute("aria-hidden", "true");
      expect(await page.evaluate(() => state.inputSession.awardedPointsForCurrentCard)).toBe(firstAttemptPoints);
      await page.waitForTimeout(300);
      await capture("corrected");
      await expect(button).toHaveText("Antwort prüfen", { timeout: 4000 });
      await expect(feedback).toBeHidden();
      for (const field of await fields.all()) {
        await expect(field).toHaveValue("");
        await expect(field).toBeEditable();
        await expect(field).toHaveAttribute("aria-invalid", "false");
      }
      if (irregular) {
        await fields.nth(0).fill("to shine");
        await fields.nth(1).fill("shone");
        await fields.nth(2).fill("shone");
      } else await fields.first().fill("shine");
      const initialHeight = await page.locator("#input-answer-card").evaluate((el) => el.offsetHeight);
      await button.tap();
      await expect(button).toHaveText("Richtig");
      await expect(feedback).toBeHidden();
      expect(await page.locator("#input-answer-card").evaluate((el) => el.offsetHeight)).toBe(initialHeight);
      await page.waitForTimeout(300);
      await capture("correct");
    });
  }
}

test("reduced motion and a short viewport keep correction help reachable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepareStudentHome(page);
  await openMode(page, "write");
  await expect(page.locator("#launch-settings-modal")).toBeHidden();
  await page.setViewportSize({ width: 768, height: 420 });
  const fields = page.locator("[data-irregular-verb-input]");
  await fields.nth(0).fill("shine");
  await fields.nth(1).fill("shined");
  await fields.nth(2).fill("shone");
  await fields.nth(2).press("Enter");
  await expect(fields.nth(1)).toBeFocused();
  await expect(fields.nth(1)).toBeInViewport();
  await page.locator("#input-reveal-answer").tap();
  const solution = page.locator("#input-feedback-correct-row");
  await solution.scrollIntoViewIfNeeded();
  await expect(solution).toBeInViewport();
  expect(await page.locator("#input-feedback").evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("internal non-correction setting shows the solution and unlocks the next card", async ({ page }) => {
  await prepareStudentHome(page);
  await openMode(page, "write");
  // This legacy setting has no student toggle; exercise its existing rendering branch directly.
  await page.evaluate(() => {
    state.inputCorrectionModeEnabled = false;
    applyInputSettingsToCurrentSession();
  });
  const fields = page.locator("[data-irregular-verb-input]");
  await fields.nth(0).fill("shine");
  await fields.nth(1).fill("shined");
  await fields.nth(2).fill("shone");
  await page.locator("#input-check-button").tap();
  await expect(page.locator("#input-feedback-correct")).toHaveText("Simple Past: shone");
  await expect(page.locator("#input-reveal-answer")).toBeHidden();
  await expect(fields.nth(1)).toBeDisabled();
  await expect(fields.nth(1)).toHaveValue("shined");
  await expect(fields.nth(1)).toBeEditable({ timeout: 5000 });
  await expect(page.locator("#input-feedback")).toHaveAttribute("inert", "");
});
