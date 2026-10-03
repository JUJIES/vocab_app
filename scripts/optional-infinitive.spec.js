const { test, expect } = require("playwright/test");
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4030";
test.use({ baseURL: BASE_URL, viewport: { width: 1024, height: 768 }, serviceWorkers: "block" });
for (const reverse of [false, true]) for (const mode of ["write", "test"]) {
  test(`${mode} accepts expect for to expect with English on the ${reverse ? "source" : "target"} side`, async ({ page }) => {
    const source = reverse ? "to expect" : "erwarten";
    const target = reverse ? "erwarten" : "to expect";
    const sourceLanguage = reverse ? "en" : "de";
    const targetLanguage = reverse ? "de" : "en";
    const sourceLabel = reverse ? "Englisch" : "Deutsch";
    const targetLabel = reverse ? "Deutsch" : "Englisch";
    const cards = Array.from({ length: 5 }, (_, i) => ({ id: `expect-${i}`, source: { text: source }, target: { text: target }, acceptedAnswers: [], examples: [{ id: "answer", source, target }], hintData: { flashcard: { exampleId: "answer", maskedWord: "______", firstLetterHint: "e_____" } } }));
    const document = { set: { title: "Infinitiv", languages: { source: sourceLanguage, target: targetLanguage }, labels: { source: sourceLabel, target: targetLabel } }, cards };
    await page.route("**/api/teacher/session", route => route.fulfill({ json: { session: { teacherId: "julius" }, teacher: { id: "julius" } } }));
    await page.route("**/api/teacher/sets/infinitive-fixture", route => route.fulfill({ json: { set: { id: "infinitive-fixture", path: "sets/user/infinitive-fixture.json", status: "published", title: "Infinitiv", learningCardCount: 5, sourceLanguage, targetLanguage, sourceLabel, targetLabel } } }));
    await page.route("**/sets/user/infinitive-fixture.json*", route => route.fulfill({ json: document }));
    await page.goto("/?teacherPractice=infinitive-fixture");
    await page.locator(`.launch-mode-modal__mode-card[data-mode-key="${mode}"]`).click();
    await page.locator("#launch-mode-start").click();
    await page.locator(`[data-learning-direction-group="launch"] [data-learning-direction="${reverse ? "target-source" : "source-target"}"]`).click();
    await page.locator("#launch-settings-start").click();
    if (mode === "write") {
      await page.locator("#input-answer-field").fill("expect");
      await page.locator("#input-check-button").click();
      await expect(page.locator("#input-check-label")).toHaveText("Richtig");
    } else {
      const inputs = page.locator(".test-stage__input");
      await expect(inputs).toHaveCount(5);
      for (const input of await inputs.all()) await input.fill("expect");
      await page.locator("#test-submit").click();
      await expect(page.locator(".test-stage__row.is-correct")).toHaveCount(5);
      await expect(page.locator(".test-stage__row.is-wrong")).toHaveCount(0);
    }
  });
}
