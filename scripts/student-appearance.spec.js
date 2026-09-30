const { test, expect } = require("playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4012";
const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "student-appearance");
test.use({ baseURL: BASE_URL, locale: "de-DE", serviceWorkers: "block" });
test.beforeAll(() => fs.mkdir(OUTPUT_DIR, { recursive: true }));
const setPath = "sets/appearance.json";
const words = [["Zug", "train"], ["Fahrrad", "bicycle"], ["Bus", "bus"], ["zu Fuß", "on foot"], ["Haltestelle", "bus stop"], ["Fahrkarte", "ticket"]];
const document = {
  set: { id: "appearance", title: "Unterwegs – Means of transport", subject: "Englisch", description: "Wörter für unsere nächste Reise", labels: { source: "Deutsch", target: "Englisch" }, languages: { source: "de", target: "en" } },
  cards: words.map(([source, target], i) => ({
    id: `card-${i}`, source: { text: source }, target: { text: target }, acceptedAnswers: [],
    examples: [{ id: "answer", source: `Wir sagen ${source} heute.`, target: `We say ${target} today.` }], hintData: { flashcard: { exampleId: "answer", maskedWord: "_____", firstLetterHint: "t____" } },
    visual: { url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' rx='40' fill='%235b8f73'/%3E%3C/svg%3E", alt: `Lernbild ${source}` },
  })),
};
async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem("dino-vocab-device-id-v1", "blau-1");
    localStorage.setItem("dino-vocab-session-unlocked-v1", "1");
    localStorage.setItem("dino-vocab-tablet-session-v1", JSON.stringify({ tabletId: "blau-1", token: "test-token" }));
  });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    let data = {};
    if (url.pathname.endsWith("runtime-info")) data = { publicOrigin: BASE_URL };
    else if (url.pathname.endsWith("tablets")) data = { tablets: [{ id: "blau-1", label: "Blau 1", registered: true }] };
    else if (url.pathname.endsWith("subscriptions")) data = { tablet: { id: "blau-1", label: "Blau 1" }, subscriptions: [{ setPath, ...document.set, cardCount: 6, sourceLanguage: "de", targetLanguage: "en", sourceLabel: "Deutsch", targetLabel: "Englisch" }] };
    else if (url.pathname.includes("learning-progress")) data = { progress: {} };
    await route.fulfill({ json: data });
  });
  await page.route("**/sets/appearance.json*", route => route.fulfill({ json: document }));
  await page.goto("/");
  await expect(page.locator(".student-screen__library-card").first()).toBeVisible();
}
async function capture(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function start(page, mode) {
  await page.locator(".student-screen__library-card").first().click();
  await page.locator(`.launch-mode-modal__mode-card[data-mode-key="${mode}"]`).click();
  await page.locator("#launch-mode-start").click();
  await page.locator('[data-learning-direction-group="launch"] [data-learning-direction="source-target"]').click();
  await page.locator("#launch-settings-start").click();
}
for (const [size, width, height] of [["tablet", 1024, 768], ["phone", 390, 760]]) {
  for (const mode of ["light", "dark"]) {
    test(`${mode}: student home and learning modes on ${size}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await prepare(page);
      const toggle = page.getByRole("switch", { name: "Helles Design" });
      if (mode === "light") await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", String(mode === "light"));
      await capture(page, `${mode}-${size}-home`);
      const contrasts = await page.evaluate(() => {
        const css = getComputedStyle(document.documentElement);
        const luminance = key => {
          const rgb = css.getPropertyValue(key).trim().slice(1).match(/../g)
            .map(value => parseInt(value, 16) / 255)
            .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        };
        const background = luminance("--surface");
        return ["--text", "--text-muted"].map(key => {
          const text = luminance(key);
          return (Math.max(text, background) + .05) / (Math.min(text, background) + .05);
        });
      });
      contrasts.forEach(ratio => expect(ratio).toBeGreaterThanOrEqual(4.5));
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-appearance-mode", mode);
      await expect(toggle).toHaveCount(1);
      await page.locator(".student-screen__library-card").first().click();
      await capture(page, `${mode}-${size}-launch`);
      await page.locator('.launch-mode-modal__mode-card[data-mode-key="practice"]').click();
      await page.locator("#launch-mode-start").click();
      await page.locator('[data-learning-direction-group="launch"] [data-learning-direction="source-target"]').click();
      await page.locator("#launch-settings-start").click();
      await expect(page.locator("#card-stage")).toBeVisible();
      await expect(toggle).toHaveCount(0);
      await expect(page.locator("html")).toHaveAttribute("data-appearance-mode", mode);
      await capture(page, `${mode}-${size}-practice`);
      await page.locator("#card-action").click();
      await expect(page.locator("#front-hint")).toHaveClass(/is-visible/);
      await capture(page, `${mode}-${size}-practice-hint`);
      await page.locator("#flashcard").click();
      await capture(page, `${mode}-${size}-practice-answer`);
      await page.locator("#student-home-link").click();
      await expect(toggle).toHaveCount(1);
      await start(page, "write");
      await expect(page.locator("#input-stage")).toBeVisible();
      await capture(page, `${mode}-${size}-input`);
      await page.locator("#input-answer-field").fill("wrong");
      await page.locator("#input-answer-form").evaluate(form => form.requestSubmit());
      await expect(page.locator("#input-feedback-title")).not.toBeEmpty();
      await capture(page, `${mode}-${size}-input-feedback`);
      const inputPrompt = (await page.locator("#input-prompt-word").textContent()).trim();
      await page.locator("#input-answer-field").fill(words.find(pair => pair[0] === inputPrompt)[1]);
      await page.locator("#input-answer-form").evaluate(form => form.requestSubmit());
      await expect(page.locator("#input-check-button")).toHaveAttribute("data-state", "correct");
      await capture(page, `${mode}-${size}-input-correct`);
      await page.locator("#input-home-link").click();
      await start(page, "test");
      await expect(page.locator("#test-stage")).toBeVisible();
      await capture(page, `${mode}-${size}-test`);
      const rows = page.locator("#test-table-body .test-stage__row");
      for (const [index, row] of (await rows.all()).entries()) {
        const prompt = (await row.locator(".test-stage__prompt").textContent()).trim();
        await row.locator(".test-stage__input").fill(index === 0 ? "wrong" : words.find(pair => pair[0] === prompt)[1]);
      }
      await page.locator("#test-submit").click();
      await expect(page.locator(".test-stage__row.is-wrong")).toHaveCount(1);
      await expect(page.locator(".test-stage__row.is-correct")).toHaveCount(5);
      await capture(page, `${mode}-${size}-test-feedback`);
      await page.locator("#test-home-link").click();
      await expect(toggle).toHaveCount(1);
      await expect(toggle).toHaveAttribute("aria-checked", String(mode === "light"));
      expect(await page.evaluate(() => localStorage.getItem("lerndeck-teacher-appearance-v1"))).toBeNull();
      expect(errors).toEqual([]);
    });
  }
}
