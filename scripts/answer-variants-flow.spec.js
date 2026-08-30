const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4177";
const DEVICE_STORAGE_KEY = "dino-vocab-device-id-v1";
const SESSION_UNLOCK_KEY = "dino-vocab-session-unlocked-v1";
const TABLET_SESSION_STORAGE_KEY = "dino-vocab-tablet-session-v1";
const ANSWERS = ["Fläche", "Gegend", "Gebiet", "Areal"];

test.use({
  viewport: { width: 1024, height: 768 },
  colorScheme: "dark",
  locale: "de-DE",
});

function buildVariantSet() {
  return {
    set: {
      id: "answer-variants-test",
      title: "Antwortvarianten",
      revision: 1,
      languages: { source: "en", target: "de" },
      labels: { source: "Englisch", target: "Deutsch" },
    },
    cards: ANSWERS.map((_, index) => ({
      id: `area-${index + 1}`,
      source: { text: `area ${index + 1}` },
      target: { text: "Fläche; Gegend; Gebiet; Areal" },
      examples: [{
        id: "answer",
        source: `area ${index + 1}`,
        target: "Fläche; Gegend; Gebiet; Areal",
      }],
      hintData: {
        flashcard: {
          exampleId: "answer",
          maskedWord: "______; ______; ______; _____",
          firstLetterHint: "F_____; ______; ______; _____",
        },
      },
      acceptedAnswers: ["Fläche; Gegend; Gebiet; Areal"],
    })),
  };
}

async function prepareStudentHome(page) {
  await page.route("**/sets/*.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildVariantSet()),
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

async function openMode(page, modeKey) {
  await page.locator(".student-screen__library-card").first().click();
  await expect(page.locator("#launch-mode-modal")).toBeVisible();
  await page.locator(`button.launch-mode-modal__mode-card[data-mode-key="${modeKey}"]`).click();
  await page.locator("#launch-mode-start").click();
}

test("answer side shows one primary term and calm alternatives without duplicate context", async ({ page }) => {
  await prepareStudentHome(page);
  await openMode(page, "view");
  await expect(page.locator("#flashcard")).toBeVisible();

  await page.locator("#flashcard").click();
  await expect(page.locator("#back-word")).toHaveText("Fläche");
  await expect(page.locator("#back-alternatives")).toHaveText("(Gegend · Gebiet · Areal)");
  await expect(page.locator("#back-hint")).toHaveText("");
  await expect(page.locator("#back-hint-shell")).toBeHidden();
  await expect(page.locator("#flashcard")).toHaveAttribute(
    "aria-label",
    /Fläche\. Weitere gültige Antworten: Gegend, Gebiet, Areal/,
  );

  const layout = await page.locator("#back-face").evaluate((face) => {
    const cardBounds = face.getBoundingClientRect();
    const wordBounds = face.querySelector("#back-word").getBoundingClientRect();
    const alternativesBounds = face.querySelector("#back-alternatives").getBoundingClientRect();
    return {
      alternativesBelowWord: alternativesBounds.top >= wordBounds.bottom,
      alternativesInsideCard:
        alternativesBounds.left >= cardBounds.left
        && alternativesBounds.right <= cardBounds.right,
    };
  });

  expect(layout.alternativesBelowWord).toBeTruthy();
  expect(layout.alternativesInsideCard).toBeTruthy();
});

test("every semicolon-delimited variant is a complete valid input answer", async ({ page }) => {
  await prepareStudentHome(page);
  await openMode(page, "write");
  await expect(page.locator("#input-answer-field")).toBeVisible();

  await page.locator("#input-settings-button").click();
  await page.locator("#input-delay-type-correct").click();
  await page.locator("#input-delay-slider").evaluate((slider) => {
    slider.value = "0";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#input-settings-button").click();

  for (let index = 0; index < ANSWERS.length; index += 1) {
    await expect(page.locator("#input-prompt-word")).toHaveText(`area ${index + 1}`);
    await page.locator("#input-answer-field").fill(ANSWERS[index]);
    await page.locator("#input-answer-form").press("Enter");
    await expect(page.locator("#input-feedback-title")).toHaveText("Richtig");
  }

  await expect(page.locator("#input-prompt-word")).toHaveText("Fertig");
});
