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

async function prepareStudentHome(page, setData = buildVariantSet()) {
  await page.route("**/sets/*.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(setData),
    });
  });

  await page.goto(new URL("/index.html", BASE_URL).toString(), { waitUntil: "networkidle" });
  await page.evaluate(async ({ deviceKey, sessionKey, tabletSessionKey }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    const tabletId = "rot-1";
    let response = await fetch(`/api/tablets/${encodeURIComponent(tabletId)}/verify-pin`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "1111" }),
    });
    let data = await response.json();

    if (response.status === 409) {
      response = await fetch(`/api/tablets/${encodeURIComponent(tabletId)}/register`, {
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

    const subscriptionResponse = await fetch(`/api/tablets/${encodeURIComponent(tabletId)}/subscriptions`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Authorization": `Bearer ${data.session.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ setPath: "sets/food-basics-01.json" }),
    });
    if (!subscriptionResponse.ok) {
      throw new Error(`Unable to prepare answer-variant subscription: ${subscriptionResponse.status}`);
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
  await expect(page.locator("#launch-settings-modal")).toBeVisible();
  await page.locator('[data-learning-direction-group="launch"] [data-learning-direction="source-target"]').click();
  await page.locator("#launch-settings-start").click();
}

test("answer side shows one primary term and calm alternatives without duplicate context", async ({ page }) => {
  await prepareStudentHome(page);
  await openMode(page, "practice");
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

test("accepted punctuation variants stay valid without repeating the primary answer", async ({ page }) => {
  const setData = buildVariantSet();
  setData.cards = [{
    id: "depends-on",
    source: { text: "Es hängt davon ab." },
    target: { text: "It depends on" },
    examples: [{
      id: "answer",
      source: "Es hängt davon ab.",
      target: "It depends on",
    }],
    hintData: {
      flashcard: {
        exampleId: "answer",
        maskedWord: "__ _______ __",
        firstLetterHint: "I_ _______ __",
      },
    },
    acceptedAnswers: ["It depends on", "It depends on ...", "It depends on …", "That depends on"],
  }];

  await prepareStudentHome(page, setData);
  await openMode(page, "practice");
  await page.locator("#flashcard").click();
  await expect(page.locator("#back-word")).toHaveText("It depends on");
  await expect(page.locator("#back-alternatives")).toHaveText("(That depends on)");
  await expect(page.locator("#flashcard")).toHaveAttribute(
    "aria-label",
    /Weitere gültige Antworten: That depends on/,
  );

  await prepareStudentHome(page, setData);
  await openMode(page, "write");
  await page.locator("#input-answer-field").fill("It depends on ...");
  await page.locator("#input-answer-form").press("Enter");
  await expect(page.locator("#input-check-button")).toHaveText("Richtig");
});

test("commas are optional when checking an answer", async ({ page }) => {
  const setData = buildVariantSet();
  setData.set.languages = { source: "de", target: "en" };
  setData.set.labels = { source: "Deutsch", target: "Englisch" };
  setData.cards = [{
    id: "agree-because",
    source: { text: "Ich stimme zu, weil …" },
    target: { text: "I agree because" },
    examples: [{
      id: "answer",
      source: "Ich stimme zu, weil …",
      target: "I agree because",
    }],
    hintData: {
      flashcard: {
        exampleId: "answer",
        maskedWord: "_ _____ _______",
        firstLetterHint: "I _____ _______",
      },
    },
    acceptedAnswers: ["I agree because"],
  }];

  await prepareStudentHome(page, setData);
  await openMode(page, "write");
  await page.locator("#input-answer-field").fill("i AGREE, because");
  await page.locator("#input-answer-form").press("Enter");
  await expect(page.locator("#input-check-button")).toHaveText("Richtig");

  setData.cards[0] = {
    ...setData.cards[0],
    id: "opinion-comma",
    source: { text: "Meiner Meinung nach …" },
    target: { text: "In my opinion," },
    examples: [{
      id: "answer",
      source: "Meiner Meinung nach …",
      target: "In my opinion,",
    }],
    acceptedAnswers: ["In my opinion,"],
  };
  await prepareStudentHome(page, setData);
  await openMode(page, "write");
  await page.locator("#input-answer-field").fill("In my opinion");
  await page.locator("#input-answer-form").press("Enter");
  await expect(page.locator("#input-check-button")).toHaveText("Richtig");
});

test("word spelling remains exact even when punctuation is optional", async ({ page }) => {
  const setData = buildVariantSet();
  setData.set.languages = { source: "de", target: "en" };
  setData.set.labels = { source: "Deutsch", target: "Englisch" };
  setData.cards = [{
    id: "cant-apostrophe",
    source: { text: "kann nicht" },
    target: { text: "can't" },
    examples: [{ id: "answer", source: "kann nicht", target: "can't" }],
    hintData: {
      flashcard: {
        exampleId: "answer",
        maskedWord: "_____",
        firstLetterHint: "c____",
      },
    },
    acceptedAnswers: ["can't"],
  }];

  await prepareStudentHome(page, setData);
  await openMode(page, "write");
  await page.locator("#input-answer-field").fill("cant.");
  await page.locator("#input-answer-form").press("Enter");
  await expect(page.locator("#input-feedback-title")).toHaveText("Markierte Antwort verbessern.");
  await expect(page.locator("#input-check-button")).toHaveText("Korrektur prüfen");

  await page.locator("#input-answer-field").fill("CAN'T!");
  await page.locator("#input-answer-form").press("Enter");
  await expect(page.locator("#input-check-button")).toHaveText("Korrigiert");
});

test("flashcards hide spelling and form variants but keep real synonyms", async ({ page }) => {
  const setData = buildVariantSet();
  setData.set.languages = { source: "de", target: "en" };
  setData.set.labels = { source: "Deutsch", target: "Englisch" };
  setData.cards = [{
    id: "motorized-vehicle",
    source: { text: "motorisiertes Fahrzeug" },
    target: { text: "motorized vehicle" },
    examples: [{
      id: "answer",
      source: "motorisiertes Fahrzeug",
      target: "motorized vehicle",
    }],
    hintData: {
      flashcard: {
        exampleId: "answer",
        maskedWord: "_________ _______",
        firstLetterHint: "m________ _______",
      },
    },
    acceptedAnswers: [
      "motorised vehicle",
      "(motorized vehicle)",
      "a motorized vehicle",
      "powered vehicle",
    ],
  }];

  await prepareStudentHome(page, setData);
  await openMode(page, "practice");
  await page.locator("#flashcard").click();
  await expect(page.locator("#back-word")).toHaveText("motorized vehicle");
  await expect(page.locator("#back-alternatives")).toHaveText("(powered vehicle)");
  await expect(page.locator("#flashcard")).toHaveAttribute(
    "aria-label",
    /Weitere gültige Antworten: powered vehicle/,
  );

  await prepareStudentHome(page, setData);
  await openMode(page, "write");
  await page.locator("#input-answer-field").fill("motorised vehicle");
  await page.locator("#input-answer-form").press("Enter");
  await expect(page.locator("#input-check-button")).toHaveText("Richtig");
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
    await expect(page.locator("#input-check-button")).toHaveText("Richtig");
  }

  await expect(page.locator("#input-prompt-word")).toHaveText("Fertig");
});
