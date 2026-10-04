const { test, expect } = require("playwright/test");
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
test.use({ baseURL: BASE_URL, viewport: { width: 1024, height: 768 }, serviceWorkers: "block" });

async function prepare(page, mode, direction) {
  await page.addInitScript(() => {
    window.spoken = [];
    const voices = [
      { name: "Daniel enhanced", lang: "en-GB", localService: true },
      { name: "Anna", lang: "de-DE", localService: true },
      { name: "Remote premium", lang: "en-GB", localService: false },
    ];
    Object.defineProperty(window, "speechSynthesis", { value: {
      getVoices: () => voices,
      addEventListener() {},
      speak(value) { window.lastUtterance = value; window.spoken.push({ text: value.text, lang: value.lang, voice: value.voice.name }); },
      cancel() { window.speechCancelled = (window.speechCancelled || 0) + 1; },
    } });
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  });
  const cards = [
    { id: "a", source: { text: "Hund" }, target: { text: "dog" } },
    { id: "b", source: { text: "Katze" }, target: { text: "cat" } },
  ].map(card => ({ ...card, examples: [{ id: "answer", source: card.source.text, target: card.target.text }], hintData: { flashcard: { exampleId: "answer" } } }));
  await page.route("**/api/runtime-info", route => route.fulfill({ json: { publicOrigin: BASE_URL } }));
  await page.route("**/api/teacher/session", route => route.fulfill({ json: { teacher: { id: "julius" }, session: { teacherId: "julius" } } }));
  await page.route("**/api/teacher/sets/speech-test", route => route.fulfill({ json: { set: { id: "speech-test", status: "published", path: "sets/user/speech-test.json", title: "Aussprache", sourceLanguage: "de", targetLanguage: "en", sourceLabel: "Deutsch", targetLabel: "Englisch", cards } } }));
  await page.route("**/sets/user/speech-test.json*", route => route.fulfill({ json: { schemaVersion: "1.2", set: { id: "speech-test", title: "Aussprache", languages: { source: "de", target: "en" }, labels: { source: "Deutsch", target: "Englisch" } }, cards } }));
  await page.goto("/?teacherPractice=speech-test");
  await expect(page.locator("#launch-mode-modal")).toBeVisible();
  await page.locator(`.launch-mode-modal__mode-card[data-mode-key="${mode}"]`).click();
  await page.locator("#launch-mode-start").click();
  await page.locator(`[data-learning-direction-group="launch"] [data-learning-direction="${direction}"]`).click();
  await page.locator("#launch-settings-start").click();
}

async function enable(page, value = true) {
  await page.locator("#input-settings-button").click();
  await page.locator("#input-speech-toggle").setChecked(value);
  await page.locator("#input-settings-button").click();
}

test("English answers remain hidden until correct; speech delays advance and persists opt-in", async ({ page }) => {
  await prepare(page, "write", "source-target");
  await expect(page.locator("#input-audio-button")).toBeHidden();
  await enable(page);
  expect(await page.evaluate(() => localStorage.getItem("lerndeck-input-speech-v1"))).toBe("true");
  await page.locator("#input-answer-field").fill("wrong");
  await page.locator("#input-check-button").click();
  await expect(page.locator("#input-audio-button")).toBeHidden();
  expect(await page.evaluate(() => spoken.length)).toBe(0);
  const prompt = await page.locator("#input-prompt-word").textContent();
  const answer = prompt === "Hund" ? "dog" : "cat";
  await page.locator("#input-answer-field").fill(answer);
  await page.locator("#input-check-button").click();
  await expect(page.locator("#input-audio-button")).toBeVisible();
  expect(await page.evaluate(() => spoken)).toEqual([{ text: answer, lang: "en-GB", voice: "Daniel enhanced" }]);
  await page.waitForTimeout(2300);
  await expect(page.locator("#input-prompt-word")).toHaveText(prompt);
  await page.evaluate(() => lastUtterance.onend());
  await expect(page.locator("#input-prompt-word")).not.toHaveText(prompt, { timeout: 4000 });
  await enable(page, false);
  const nextPrompt = await page.locator("#input-prompt-word").textContent();
  await page.locator("#input-answer-field").fill(nextPrompt === "Hund" ? "dog" : "cat");
  await page.locator("#input-check-button").click();
  expect(await page.evaluate(() => spoken.length)).toBe(1);
  await page.locator("#input-audio-button").click();
  expect(await page.evaluate(() => spoken.length)).toBe(2);
  await expect(page.locator("#input-settings-popover")).toBeHidden();
  await page.screenshot({ path: "artifacts/local-speech-input.png", fullPage: true });
});

test("English prompt is playable and changing direction cancels speech without revealing the answer", async ({ page }) => {
  await prepare(page, "write", "target-source");
  await page.locator("#input-audio-button").click();
  const utterance = await page.evaluate(() => spoken[0]);
  expect(utterance.lang).toBe("en-GB");
  await page.locator("#input-settings-button").click();
  await page.locator('[data-learning-direction-group="input"] [data-learning-direction="source-target"]').click();
  await expect(page.locator("#input-audio-button")).toBeHidden();
  expect(await page.evaluate(() => speechCancelled)).toBeGreaterThan(0);
  await page.locator("#input-settings-button").click();
  await expect(page.locator("#input-settings-popover")).toBeVisible();
  await expect(page.locator("#input-settings-popover")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "artifacts/local-speech-settings.png", fullPage: true });
});

test("practice speaks only the visible side and reverses language correctly", async ({ page }) => {
  await prepare(page, "practice", "target-source");
  await page.locator('[data-audio-face="front"]').click();
  expect(await page.evaluate(() => spoken[0].lang)).toBe("en-GB");
  // Existing controls suppress accidental card flips for 320 ms after tapping audio.
  await page.waitForTimeout(350);
  await page.locator("#front-word").click();
  await page.locator('[data-audio-face="back"]').click();
  expect(await page.evaluate(() => spoken[1].lang)).toBe("de-DE");
  await page.screenshot({ path: "artifacts/local-speech-practice.png", fullPage: true });
});

test("portrait light tablet handles missing local voices without blocking progression", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.addInitScript(() => localStorage.setItem("lerndeck-teacher-appearance-v1", JSON.stringify({ mode: "light" })));
  await prepare(page, "write", "source-target");
  await page.evaluate(() => { speechSynthesis.getVoices = () => [{ name: "Remote English", lang: "en-GB", localService: false }]; });
  await enable(page);
  const prompt = await page.locator("#input-prompt-word").textContent();
  await page.locator("#input-answer-field").fill(prompt === "Hund" ? "dog" : "cat");
  await page.locator("#input-check-button").click();
  await expect(page.locator("#input-audio-button")).toBeDisabled();
  await expect(page.locator("#input-audio-feedback")).toContainText("Aussprache nicht verfügbar");
  expect(await page.evaluate(() => spoken.length)).toBe(0);
  await expect(page.locator("#input-prompt-word")).not.toHaveText(prompt, { timeout: 4000 });
  await page.locator("#input-settings-button").click();
  await expect(page.locator("#input-settings-popover")).toBeVisible();
  await expect(page.locator("#input-settings-popover")).toHaveCSS("opacity", "1");
  const bounds = await page.locator("#input-settings-popover").boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(820);
  await page.screenshot({ path: "artifacts/local-speech-light-portrait.png", fullPage: true });
});
