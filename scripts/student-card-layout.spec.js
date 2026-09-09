const { test, expect } = require("playwright/test");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4177";
const DEVICE_STORAGE_KEY = "dino-vocab-device-id-v1";
const SESSION_UNLOCK_KEY = "dino-vocab-session-unlocked-v1";
const TABLET_SESSION_STORAGE_KEY = "dino-vocab-tablet-session-v1";
const VISUAL_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Crect width='512' height='512' fill='%235b8f73'/%3E%3C/svg%3E";

test.use({
  viewport: { width: 1024, height: 768 },
  colorScheme: "dark",
  locale: "de-DE",
  hasTouch: true,
  deviceScaleFactor: 2,
});

function buildVisualSet({ withVisual = true, revision = 1 } = {}) {
  return {
    set: {
      id: "student-card-layout-test",
      title: "Society and Sustainability",
      revision,
      languages: { source: "de", target: "en" },
      labels: { source: "Deutsch", target: "Englisch" },
    },
    cards: ["umweltfreundlich", "nachhaltig", "verantwortungsvoll"].map((source, index) => ({
      id: `layout-${index + 1}`,
      source: { text: source },
      target: { text: index === 0 ? "eco-friendly" : `answer ${index + 1}` },
      examples: [{
        id: "example",
        source,
        target: index === 0 ? "eco-friendly" : `answer ${index + 1}`,
      }],
      hintData: {
        flashcard: {
          exampleId: "example",
          maskedWord: "________",
          firstLetterHint: "a_______",
        },
      },
      acceptedAnswers: [],
      visual: withVisual ? {
        url: VISUAL_URL,
        alt: `Lernbild zu ${source}`,
      } : null,
    })),
  };
}

async function prepareStudentHome(page, options = {}) {
  await page.route("**/sets/*.json", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(
      typeof options.setProvider === "function"
        ? options.setProvider()
        : buildVisualSet(options),
    ),
  }));

  await page.goto(new URL("/health", BASE_URL).toString(), { waitUntil: "networkidle" });
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
      throw new Error(`Unable to prepare layout subscription: ${subscriptionResponse.status}`);
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
  await page.evaluate(async () => {
    Math.random = () => 0.5;
    await (document.fonts?.ready || Promise.resolve());
  });
  await expect(page.locator(".student-screen__library-card").first()).toBeVisible();
}

async function openMode(page, modeKey) {
  await page.locator(".student-screen__library-card").first().click();
  await expect(page.locator("#launch-mode-modal")).toBeVisible();
  await page.locator(`button.launch-mode-modal__mode-card[data-mode-key="${modeKey}"]`).click();
  await page.locator("#launch-mode-start").click();
  await expect(page.locator("#launch-settings-modal")).toBeVisible();
  await page.locator(
    '[data-learning-direction-group="launch"] [data-learning-direction="source-target"]',
  ).click();
  await page.locator("#launch-settings-start").click();
  await expect(page.locator(modeKey === "write" ? "#input-stage" : "#flashcard")).toBeVisible();
}

test("long German terms stay on one line and inside the iPad and desktop card", async ({ page }) => {
  await prepareStudentHome(page);
  await openMode(page, "practice");

  const word = page.locator("#front-word");
  await expect(word).toHaveText("umweltfreundlich");
  await expect(word).toHaveClass(/is-single-term/);

  const metrics = await word.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const textRects = Array.from(range.getClientRects());
    const faceBounds = element.closest(".flashcard__face").getBoundingClientRect();
    const wordBounds = element.getBoundingClientRect();
    return {
      lineCount: textRects.length,
      insideCard: wordBounds.left >= faceBounds.left && wordBounds.right <= faceBounds.right,
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
    };
  });

  expect(metrics.lineCount).toBe(1);
  expect(metrics.insideCard).toBeTruthy();
  expect(metrics.fontSize).toBeLessThan(60);

  await page.setViewportSize({ width: 1366, height: 900 });
  const desktopMetrics = await word.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const faceBounds = element.closest(".flashcard__face").getBoundingClientRect();
    const wordBounds = element.getBoundingClientRect();
    return {
      lineCount: Array.from(range.getClientRects()).length,
      insideCard: wordBounds.left >= faceBounds.left && wordBounds.right <= faceBounds.right,
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
    };
  });

  expect(desktopMetrics.lineCount).toBe(1);
  expect(desktopMetrics.insideCard).toBeTruthy();
  expect(desktopMetrics.fontSize).toBeLessThan(60);
});

test("practice front keeps word and tip action in one balanced vertical composition", async ({ page }, testInfo) => {
  await prepareStudentHome(page, { withVisual: false });
  await openMode(page, "practice");

  async function readComposition() {
    return page.locator("#front-face").evaluate((face) => {
      const faceBounds = face.getBoundingClientRect();
      const wordBounds = face.querySelector("#front-word").getBoundingClientRect();
      const actionBounds = face.querySelector("#card-action").getBoundingClientRect();
      return {
        wordCenterRatio: ((wordBounds.top + wordBounds.height / 2) - faceBounds.top) / faceBounds.height,
        actionCenterRatio: ((actionBounds.top + actionBounds.height / 2) - faceBounds.top) / faceBounds.height,
        gapRatio: (actionBounds.top - wordBounds.bottom) / faceBounds.height,
      };
    });
  }

  for (const viewport of [
    { name: "tablet", width: 1024, height: 768 },
    { name: "desktop", width: 1366, height: 900 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const composition = await readComposition();
    expect(composition.wordCenterRatio).toBeGreaterThan(0.39);
    expect(composition.wordCenterRatio).toBeLessThan(0.48);
    expect(composition.actionCenterRatio).toBeGreaterThan(0.76);
    expect(composition.actionCenterRatio).toBeLessThan(0.88);
    expect(composition.gapRatio).toBeGreaterThan(0.12);
    expect(composition.gapRatio).toBeLessThan(0.38);
    await page.locator("#flashcard").screenshot({
      path: testInfo.outputPath(`practice-front-${viewport.name}.png`),
    });
  }

  await expect(page.locator("#card-action")).toBeEnabled({ timeout: 3000 });
  await page.locator("#card-action").click();
  await expect(page.locator("#front-content")).toHaveClass(/has-hint/);
  const hintClearance = await page.locator("#front-face").evaluate((face) => {
    const hintBounds = face.querySelector(".flashcard__hint-shell").getBoundingClientRect();
    const actionBounds = face.querySelector("#card-action").getBoundingClientRect();
    return actionBounds.top - hintBounds.bottom;
  });
  expect(hintClearance).toBeGreaterThan(8);
  await page.locator("#flashcard").screenshot({
    path: testInfo.outputPath("practice-front-desktop-with-hint.png"),
  });
});

test("front and back use the same type size for differently long terms", async ({ page }) => {
  await prepareStudentHome(page, { withVisual: false });
  await openMode(page, "practice");
  await expect(page.locator("#front-word")).toHaveText("umweltfreundlich");
  await expect(page.locator("#back-word")).toHaveText("eco-friendly");

  const frontSize = await page.locator("#front-word").evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).fontSize),
  );
  await expect(page.locator("#front-word")).toHaveClass(/has-paired-term-size/);
  await expect(page.locator("#back-word")).toHaveClass(/has-paired-term-size/);

  await page.locator("#flashcard").click();
  await expect(page.locator("#flashcard")).toHaveClass(/is-flipped/);
  const backSize = await page.locator("#back-word").evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).fontSize),
  );

  expect(frontSize).toBe(backSize);
  expect(frontSize).toBeLessThan(60);
});

test("practice swipes freely forward and backward on both card faces", async ({ page }) => {
  await prepareStudentHome(page, { withVisual: false });
  await openMode(page, "practice");

  const card = page.locator("#flashcard");
  await expect(page.locator("#front-word")).not.toHaveText("\u00a0");
  const firstWord = await page.locator("#front-word").textContent();
  await expect(page.locator("[data-eval-button]")).toHaveCount(0);

  async function swipe(deltaX) {
    const bounds = await card.boundingBox();
    const startX = bounds.x + bounds.width / 2;
    const startY = bounds.y + bounds.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY, { steps: 8 });
    await page.mouse.up();
  }

  await swipe(-260);
  await expect(page.locator("#front-word")).not.toHaveText(firstWord);
  await expect(card).not.toHaveClass(/is-flipped/);

  await card.click();
  await expect(card).toHaveClass(/is-flipped/);
  await swipe(260);
  await expect(page.locator("#front-word")).toHaveText(firstWord);
  await expect(card).not.toHaveClass(/is-flipped/);
});

test("cards without a visual do not leave an empty frame", async ({ page }) => {
  await prepareStudentHome(page, { withVisual: false });
  await openMode(page, "practice");

  await expect(page.locator("#front-visual")).toHaveCount(0);
  const visual = page.locator("#back-visual");
  await expect(visual).toHaveJSProperty("hidden", true);
  expect(await visual.evaluate((element) => getComputedStyle(element).display)).toBe("none");
  await expect(page.locator("#front-content")).not.toHaveClass(/has-visual/);
  await expect(visual.locator("..")).not.toHaveClass(/has-visual/);
});

test("practice keeps the front image tile absent and reveals the image on the back", async ({ page }) => {
  await prepareStudentHome(page);
  await openMode(page, "practice");

  await expect(page.locator("#front-visual")).toHaveCount(0);
  await expect(page.locator("#front-content")).not.toHaveClass(/has-visual/);
  await expect(page.locator("#back-face")).toHaveAttribute("aria-hidden", "true");

  await page.locator("#flashcard").click();
  await expect(page.locator("#back-face")).toHaveAttribute("aria-hidden", "false");
  const visual = page.locator("#back-visual");
  await expect(visual).toBeVisible();
  await expect(visual.locator("..")).toHaveClass(/has-visual/);
  await expect.poll(() => visual.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
  await expect(visual).toHaveAttribute("alt", "Lernbild zu umweltfreundlich");
});

test("practice adds finished visuals without restarting the current card", async ({ page }) => {
  let visualsReady = false;
  await prepareStudentHome(page, {
    setProvider: () => buildVisualSet({
      withVisual: visualsReady,
      revision: visualsReady ? 2 : 1,
    }),
  });
  await openMode(page, "practice");

  const card = page.locator("#flashcard");
  await expect(page.locator("#front-word")).not.toHaveText("\u00a0");
  const currentWord = await page.locator("#front-word").textContent();
  const currentProgress = await page.locator("#progress-label").textContent();
  await card.click();
  await expect(card).toHaveClass(/is-flipped/);
  await expect(page.locator("#back-visual")).toBeHidden();

  visualsReady = true;
  const refreshed = await page.evaluate(() => refreshPracticeVisuals());

  expect(refreshed).toBeTruthy();
  await expect(page.locator("#front-word")).toHaveText(currentWord);
  await expect(page.locator("#progress-label")).toHaveText(currentProgress);
  await expect(card).toHaveClass(/is-flipped/);
  await expect(page.locator("#back-visual")).toBeVisible();
  await expect(page.locator("#back-visual")).toHaveAttribute("alt", `Lernbild zu ${currentWord}`);
});

test("input reveals the image after the first answer and keeps it during correction", async ({ page }) => {
  await prepareStudentHome(page);
  await openMode(page, "write");

  const visual = page.locator("#input-prompt-visual");
  const promptPane = visual.locator("..");
  await expect(visual).toBeHidden();
  await expect(promptPane).not.toHaveClass(/has-visual/);

  await page.locator("#input-answer-field").fill("absichtlich falsch");
  await page.locator("#input-check-button").click();

  await expect(page.locator("#input-feedback-title")).toHaveText("Markierte Antwort verbessern.");
  await expect(visual).toBeVisible();
  await expect(promptPane).toHaveClass(/has-visual/);
  await expect.poll(() => visual.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
});
