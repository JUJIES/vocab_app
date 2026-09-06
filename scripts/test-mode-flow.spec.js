const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const DEVICE_STORAGE_KEY = "dino-vocab-device-id-v1";
const SESSION_UNLOCK_KEY = "dino-vocab-session-unlocked-v1";
const TABLET_SESSION_STORAGE_KEY = "dino-vocab-tablet-session-v1";

test.use({
  viewport: { width: 1024, height: 768 },
  colorScheme: "dark",
  locale: "de-DE",
});

function buildTestSet() {
  return {
    set: {
      id: "test-mode-flow",
      title: "Testmodus Probe",
      labels: { source: "Deutsch", target: "Englisch" },
      languages: { source: "de", target: "en" },
    },
    cards: Array.from({ length: 8 }, (_, index) => {
      const number = index + 1;
      return {
        id: `test-card-${number}`,
        source: { text: `Wort ${number}` },
        target: { text: `answer ${number}` },
        acceptedAnswers: [],
        examples: [{
          id: "example",
          source: `Wort ${number}`,
          target: `answer ${number}`,
        }],
        hintData: {
          flashcard: {
            exampleId: "example",
            maskedWord: "______",
            firstLetterHint: "a_____",
          },
        },
        visual: {
          url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'/%3E",
          alt: `Bild ${number}`,
        },
      };
    }),
  };
}

async function prepareStudentHome(page) {
  await page.route("**/sets/*.json", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(buildTestSet()),
  }));

  await page.goto(new URL("/index.html", BASE_URL).toString(), { waitUntil: "networkidle" });
  await page.evaluate(async ({ deviceKey, sessionKey, tabletSessionKey }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    let response = await fetch("/api/tablets/rot-1/verify-pin", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "1111" }),
    });
    let data = await response.json();
    if (response.status === 409) {
      response = await fetch("/api/tablets/rot-1/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1111" }),
      });
      data = await response.json();
    }
    if (!response.ok || !data?.session?.token) {
      throw new Error(`Unable to prepare tablet session: ${response.status}`);
    }
    const subscriptionResponse = await fetch("/api/tablets/rot-1/subscriptions", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Authorization": `Bearer ${data.session.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ setPath: "sets/food-basics-01.json" }),
    });
    if (!subscriptionResponse.ok) {
      throw new Error(`Unable to prepare test subscription: ${subscriptionResponse.status}`);
    }
    window.localStorage.setItem(deviceKey, "rot-1");
    window.sessionStorage.setItem(sessionKey, "1");
    window.sessionStorage.setItem(tabletSessionKey, JSON.stringify({
      tabletId: "rot-1",
      token: data.session.token,
    }));
  }, {
    deviceKey: DEVICE_STORAGE_KEY,
    sessionKey: SESSION_UNLOCK_KEY,
    tabletSessionKey: TABLET_SESSION_STORAGE_KEY,
  });

  await page.goto(new URL("/index.html", BASE_URL).toString(), { waitUntil: "networkidle" });
  await expect(page.locator(".student-screen__library-card").first()).toBeVisible();
}

test("test mode uses a random-sized list and keeps wrong answers editable until all are correct", async ({ page }) => {
  await prepareStudentHome(page);
  await page.evaluate(() => {
    Math.random = () => 0;
  });
  const learningProgressApi = await page.evaluate(async ({ tabletSessionKey }) => {
    const session = JSON.parse(window.sessionStorage.getItem(tabletSessionKey));
    const headers = {
      "Authorization": `Bearer ${session.token}`,
      "Content-Type": "application/json",
    };
    const readResponse = await fetch("/api/tablets/rot-1/learning-progress?set=sets%2Ffood-basics-01.json", {
      headers,
    });
    const readData = await readResponse.json();
    const legacyWriteResponse = await fetch("/api/tablets/rot-1/learning-progress", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        setPath: "sets/food-basics-01.json",
        starStates: { "legacy-card": "orange" },
      }),
    });
    return {
      readStatus: readResponse.status,
      hasStarStates: Object.hasOwn(readData.progress || {}, "starStates"),
      legacyWriteStatus: legacyWriteResponse.status,
    };
  }, { tabletSessionKey: TABLET_SESSION_STORAGE_KEY });
  expect(learningProgressApi).toEqual({
    readStatus: 200,
    hasStarStates: false,
    legacyWriteStatus: 404,
  });

  await page.locator(".student-screen__library-card").first().click();

  const modeCards = page.locator(".launch-mode-modal__mode-card");
  await expect(modeCards).toHaveCount(3);
  await expect(page.locator('[data-mode-key="view"]')).toHaveCount(0);
  await expect(page.locator("[data-star-button]" )).toHaveCount(0);

  await page.locator('.launch-mode-modal__mode-card[data-mode-key="test"]').click();
  await expect(page.locator(".launch-mode-modal__test-count-slider")).toHaveCount(0);
  await page.locator("#launch-mode-start").click();
  await expect(page.locator("#launch-settings-modal")).toBeVisible();
  await expect(page.locator("#launch-settings-title")).toHaveText("Testeinstellungen");
  await expect(page.locator('[data-learning-direction-group="launch"]')).toBeVisible();
  const countSlider = page.locator(".launch-mode-modal__test-count-slider");
  await expect(countSlider).toBeVisible();
  await expect(countSlider).toHaveAttribute("min", "5");
  await countSlider.evaluate((slider) => {
    slider.value = "5";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator(".launch-mode-modal__test-count-value")).toContainText("5 von");

  await page.locator('[data-learning-direction-group="launch"] [data-learning-direction="source-target"]').click();
  await expect(page.locator("#launch-settings-modal")).toBeVisible();
  await page.locator("#launch-settings-start").click();

  await expect(page.locator("#test-stage")).toBeVisible();
  await expect(page.locator("#test-table-body .test-stage__row")).toHaveCount(5);
  await expect(page.locator("#test-stage img, #test-stage [data-audio-button]")).toHaveCount(0);

  const rows = page.locator("#test-table-body .test-stage__row");
  await expect(rows.locator(".test-stage__prompt")).toHaveText([
    "Wort 2",
    "Wort 3",
    "Wort 4",
    "Wort 5",
    "Wort 6",
  ]);
  for (let index = 0; index < 5; index += 1) {
    const row = rows.nth(index);
    const prompt = await row.locator(".test-stage__prompt").textContent();
    const number = prompt.match(/\d+/)?.[0];
    await row.locator(".test-stage__input").fill(index === 0 ? "wrong" : `answer ${number}`);
  }

  await page.locator("#test-submit").click();
  await expect(page.locator("#test-feedback-title")).toHaveText("4 richtig · 1 falsch");
  await expect(page.locator(".test-stage__row.is-wrong")).toHaveCount(1);
  const correctInputs = page.locator(".test-stage__row.is-correct .test-stage__input");
  await expect(correctInputs).toHaveCount(4);
  await expect(correctInputs.first()).toHaveAttribute("readonly", "");
  await expect(page.locator("#test-stage")).not.toContainText("Korrekte Lösung");

  const wrongRow = page.locator(".test-stage__row.is-wrong");
  const wrongPrompt = await wrongRow.locator(".test-stage__prompt").textContent();
  const wrongNumber = wrongPrompt.match(/\d+/)?.[0];
  await wrongRow.locator(".test-stage__input").fill(`answer ${wrongNumber}`);
  await page.locator("#test-submit").click();

  await expect(page.locator("#test-feedback-title")).toHaveText("Alles richtig");
  await expect(page.locator(".test-stage__row.is-wrong")).toHaveCount(0);
  await expect(page.locator("#test-submit")).toHaveText("Neuen Test starten");

  await page.setViewportSize({ width: 390, height: 844 });
  const responsiveLayout = await page.locator("#test-stage").evaluate((stage) => ({
    pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    tableFits: stage.querySelector(".test-stage__table-shell").getBoundingClientRect().right <= window.innerWidth,
    submitFits: stage.querySelector("#test-submit").getBoundingClientRect().right <= window.innerWidth,
  }));
  expect(responsiveLayout.pageFits).toBeTruthy();
  expect(responsiveLayout.tableFits).toBeTruthy();
  expect(responsiveLayout.submitFits).toBeTruthy();
});

test("practice starts with a shuffled card order", async ({ page }) => {
  await prepareStudentHome(page);
  await page.evaluate(() => {
    Math.random = () => 0.999999;
  });

  await page.locator(".student-screen__library-card").first().click();
  await page.locator('.launch-mode-modal__mode-card[data-mode-key="practice"]').click();
  await page.locator("#launch-mode-start").click();
  await expect(page.locator("#launch-settings-modal")).toBeVisible();
  await page.locator("#launch-settings-start").click();

  await expect(page.locator("#flashcard")).toBeVisible();
  await expect(page.locator("#front-word")).toHaveText("Wort 2");
});
