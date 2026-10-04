const { test, expect } = require("playwright/test");
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
test.use({ baseURL: BASE_URL, viewport: { width: 1024, height: 768 }, serviceWorkers: "block" });

async function prepare(page, mode, direction, suppliedCards = null) {
  await page.addInitScript(() => {
    window.spoken = [];
    window.recordings = [];
    window.Audio = class extends EventTarget {
      pause() {}
      play() { window.recordings.push(this.src); return Promise.resolve(); }
    };
    const voices = [
      { name: "Daniel enhanced", lang: "en-GB", localService: true },
      { name: "Anna", lang: "de-DE", localService: true },
      { name: "Samantha enhanced", lang: "en-US", localService: true },
      { name: "Remote premium", lang: "en-GB", localService: false },
    ];
    window.voiceListeners = [];
    Object.defineProperty(window, "speechSynthesis", { value: {
      getVoices: () => voices,
      addEventListener(_event, callback) { window.voiceListeners.push(callback); },
      speak(value) { window.lastUtterance = value; window.spoken.push({ text: value.text, lang: value.lang, voice: value.voice.name }); },
      cancel() { window.speechCancelled = (window.speechCancelled || 0) + 1; },
    } });
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  });
  const cards = (suppliedCards || [
    { id: "a", source: { text: "Hund" }, target: { text: "dog" } },
    { id: "b", source: { text: "Katze" }, target: { text: "cat" } },
  ]).map(card => ({ ...card, examples: [{ id: "answer", source: card.source.text, target: card.target.text }], hintData: { flashcard: { exampleId: "answer" } } }));
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

for (const answer of ["eco-friendly", "environmentally friendly", "expect"]) {
  test(`accepted variant ${answer} is spoken automatically and on manual replay`, async ({ page }) => {
    const primary = answer === "expect" ? "to expect" : "environmentally friendly";
    await prepare(page, "write", "source-target", [{
      id: "variant", source: { text: answer === "expect" ? "erwarten" : "umweltfreundlich" },
      target: { text: primary }, acceptedAnswers: answer === "expect" ? [] : ["eco-friendly"],
      audio: { target: "/audio/canonical.mp3" },
    }]);
    await enable(page);
    await page.locator("#input-answer-field").fill("wrong");
    await page.locator("#input-check-button").click();
    expect(await page.evaluate(() => spoken.length)).toBe(0);
    await page.locator("#input-answer-field").fill(answer);
    await page.locator("#input-check-button").click();
    expect(await page.evaluate(() => spoken[0].text)).toBe(answer);
    await expect(page.locator("#input-audio-button")).toHaveAttribute("aria-label", `${answer} anhören`);
    await page.locator("#input-audio-button").click();
    expect(await page.evaluate(() => spoken[1].text)).toBe(answer);
    // Recordings without accent metadata cannot substitute a selected English accent.
    await page.evaluate(() => { speechSynthesis.getVoices = () => []; });
    await page.locator("#input-audio-button").click();
    expect(await page.evaluate(() => recordings)).toEqual([]);
  });
}

test("accepted irregular verb forms are spoken with the submitted variants and pauses", async ({ page }) => {
  await prepare(page, "write", "source-target", [{
    id: "verb", source: { text: "lernen" }, target: { text: "to learn - learnt - learnt" },
    acceptedAnswers: ["to learn - learned - learned"],
  }]);
  await enable(page);
  const fields = page.locator("#input-verb-answer-fields input");
  await expect(fields).toHaveCount(3);
  for (const [index, value] of ["learn", "learned", "learnt"].entries()) await fields.nth(index).fill(value);
  await page.locator("#input-check-button").click();
  expect(await page.evaluate(() => spoken[0].text)).toBe("learn, learned, learnt");
  await page.locator("#input-audio-button").click();
  expect(await page.evaluate(() => spoken[1].text)).toBe("learn, learned, learnt");
});


async function chooseAccent(page, group, accent) {
  const button = group === "input" ? "#input-settings-button" : "#flashcard-settings-button";
  await page.locator(button).click();
  await page.locator(`[data-speech-accent-group="${group}"] input[value="${accent}"]`).check();
  await page.locator(button).click();
}

test("accent switches preserve the accepted variant, cancel playback and persist on reload", async ({ page }) => {
  await prepare(page, "write", "source-target", [{
    id: "accent", source: { text: "umweltfreundlich" }, target: { text: "environmentally friendly" }, acceptedAnswers: ["eco-friendly"],
  }]);
  await enable(page);
  await page.locator("#input-answer-field").fill("eco-friendly");
  await page.locator("#input-check-button").click();
  expect(await page.evaluate(() => spoken[0])).toMatchObject({ text: "eco-friendly", lang: "en-GB" });
  await chooseAccent(page, "input", "en-US");
  expect(await page.evaluate(() => speechCancelled)).toBeGreaterThan(0);
  await page.locator("#input-audio-button").click();
  expect(await page.evaluate(() => spoken[1])).toMatchObject({ text: "eco-friendly", lang: "en-US", voice: "Samantha enhanced" });
  expect(await page.evaluate(() => localStorage.getItem("lerndeck-speech-accent-v1"))).toBe("en-US");
  await page.reload();
  await expect(page.locator('[data-speech-accent-group="input"] input[value="en-US"]')).toBeChecked();
  await expect(page.locator('[data-speech-accent-group="flashcard"] input[value="en-US"]')).toBeChecked();
});

test("practice switches English accent while German pronunciation stays German", async ({ page }) => {
  await prepare(page, "practice", "target-source");
  await chooseAccent(page, "flashcard", "en-US");
  await page.locator('[data-audio-face="front"]').click();
  expect(await page.evaluate(() => spoken[0].lang)).toBe("en-US");
  await page.waitForTimeout(350);
  await page.locator("#front-word").click();
  await page.locator('[data-audio-face="back"]').click();
  expect(await page.evaluate(() => spoken[1].lang)).toBe("de-DE");
});

test("a missing accent is explained and remote or other-accent voices are not substituted", async ({ page }) => {
  await prepare(page, "write", "target-source");
  await page.evaluate(() => { speechSynthesis.getVoices = () => [
    { name: "British", lang: "en-GB", localService: true },
    { name: "Remote American", lang: "en-US", localService: false },
  ]; });
  await chooseAccent(page, "input", "en-US");
  await expect(page.locator("#input-audio-button")).toBeDisabled();
  await expect(page.locator('[data-speech-accent-group="input"] [data-speech-accent-feedback]')).toContainText("amerikanische Aussprache");
  expect(await page.evaluate(() => spoken.length)).toBe(0);
  await page.evaluate(() => {
    speechSynthesis.getVoices = () => [{ name: "New American", lang: "en-US", localService: true }];
    voiceListeners.forEach(callback => callback());
  });
  await expect(page.locator("#input-audio-button")).toBeEnabled();
  await expect(page.locator('[data-speech-accent-group="input"] [data-speech-accent-feedback]')).toBeEmpty();
  await page.locator("#input-audio-button").click();
  expect(await page.evaluate(() => spoken[0].lang)).toBe("en-US");
});

for (const [width, height, appearance] of [[1024, 768, "dark"], [390, 844, "light"]]) {
  test(`accent controls fit ${width}px in ${appearance} appearance`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(mode => localStorage.setItem("lerndeck-teacher-appearance-v1", JSON.stringify({ mode })), appearance);
    await prepare(page, "write", "target-source");
    await page.locator("#input-settings-button").click();
    const choice = page.locator('[data-speech-accent-group="input"] input[value="en-US"]');
    await choice.check();
    await expect(choice).toBeChecked();
    await expect(page.locator("#input-settings-popover")).toHaveCSS("opacity", "1");
    const bounds = await page.locator("#input-settings-popover").boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    await page.screenshot({ path: `artifacts/speech-accent-${width}-${appearance}.png`, fullPage: true });
  });
}
