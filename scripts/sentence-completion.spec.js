const { test, expect } = require("playwright/test");
test.use({ baseURL: process.env.BASE_URL || "http://127.0.0.1:4043", viewport: { width: 1280, height: 950 }, locale: "de-DE", serviceWorkers: "block" });

async function exercise(page, mode, { long = false } = {}) {
  await page.addInitScript(mode => localStorage.setItem("lerndeck-teacher-appearance-v1", JSON.stringify({ mode })), mode);
  const set = { id: "completion-fixture", path: "sets/user/completion-fixture.json", title: "Words in context", status: "published", sourceLanguage: "de", targetLanguage: "en", learningCardCount: 8, cards: [] };
  await page.route("**/api/teacher/session", route => route.fulfill({ json: { session: { teacherId: "julius" }, teacher: { id: "julius" } } }));
  await page.route("**/api/teacher/sets/completion-fixture", route => route.fulfill({ json: { set } }));
  let starts = 0, summaries = 0;
  let run;
  const rows = [
    { promptId: "p1", sourceSentence: "Ich höre oft Musik.", answer: "I often listen to music.", attemptCount: 2 },
    { promptId: "p2", sourceSentence: "Sie hat zwei Katzen.", answer: "She has two cats.", attemptCount: 1 },
  ];
  const summary = { praise: "Du hast die Vokabeln passend übersetzt und deine Verbform verbessert 👍", points: [{ title: "Verbform", tip: "Bei `I` brauchst du für eine Gewohnheit die Grundform, keine `-ing`-Form.", examples: [{ attemptId: "a1", wrong: "listening", right: "listen" }] }] };
  await page.route("**/api/sentence-practice/*", async route => {
    const action = route.request().url().split("/").pop();
    const body = route.request().postDataJSON();
    if (action === "start") {
      starts++; expect(body.count).toBe(2); expect(body.difficulty).toBe("medium");
      run = { id: "r" + starts, total: 2, position: 1, difficulty: "medium", targetLanguage: "en", prompt: { id: "p1", prefix: "Ich höre ", focus: "oft", suffix: " Musik." }, accepted: false, history: [], shown: true };
    }
    if (action === "check") {
      run.accepted = !body.answer.includes("listening");
      const entry = { id: "a" + (run.history.length + 1), answer: body.answer, feedback: run.accepted ? "Passt 👍" : "Überarbeite die Verbform 🔎", status: run.accepted ? "accepted" : "revise", issues: [], help: null };
      run.history.push(entry); Object.assign(run, { status: entry.status, checkedAnswer: body.answer, feedback: entry.feedback });
    }
    if (action === "next") {
      if (run.position === 1) Object.assign(run, { position: 2, prompt: { id: "p2", prefix: "Sie hat zwei ", focus: "Katzen", suffix: "." }, accepted: false, history: [], feedback: "", checkedAnswer: "", status: "ready" });
      else Object.assign(run, { complete: true, completion: { sentences: long ? Array.from({ length: 20 }, (_, index) => ({ ...rows[index % 2], promptId: "many-" + index })) : rows, summary: null } });
    }
    if (action === "summary") {
      summaries++; expect(body.answer).toBeUndefined();
      if (summaries === 1) return route.fulfill({ status: 503, json: { error: "Zusammenfassung momentan nicht verfügbar. Bitte erneut versuchen." } });
      await new Promise(resolve => setTimeout(resolve, 200)); run.completion.summary = summary;
    }
    return route.fulfill({ json: { run } });
  });
  await page.goto("/?teacherPractice=completion-fixture");
  await page.locator('[data-mode-key="sentence"].launch-mode-modal__mode-card').click();
  await page.locator("#launch-mode-start").click();
  await page.locator('.launch-mode-modal__test-count-slider').fill("2");
  await page.locator('input[name="sentence-difficulty"][value="medium"]').check();
  await page.locator("#launch-settings-start").click();
  for (const answer of ["I often listening to music.", "I often listen to music."]) {
    await page.locator("#sentence-answer").fill(answer); await page.locator("#sentence-submit").click();
  }
  await page.locator("#sentence-submit").click();
  await page.locator("#sentence-answer").fill("She has two cats."); await page.locator("#sentence-submit").click(); await page.locator("#sentence-submit").click();
  await expect(page.locator("#sentence-completion")).toBeVisible();
  return { starts: () => starts, summaries: () => summaries };
}

for (const mode of ["light", "dark"]) test(`completion overview, requested feedback, retry, reload and repeat (${mode})`, async ({ page }, info) => {
  const api = await exercise(page, mode);
  const dialog = page.locator("#sentence-completion");
  await expect(page.locator("#sentence-completion-title")).toBeFocused();
  await expect(dialog.locator(".sentence-completion__answer")).toHaveText(["I often listen to music.", "She has two cats."]);
  await expect(dialog.locator(".sentence-completion__count")).toHaveText(["2 Versuche", "1 Versuch"]);
  await expect(page.locator("#sentence-summary")).toBeHidden(); expect(api.summaries()).toBe(0);
  await dialog.screenshot({ path: info.outputPath(`${mode}-overview.png`) });
  await page.locator("#sentence-summary-request").click();
  await expect(page.locator("#sentence-summary-notice")).toContainText("nicht verfügbar");
  await expect(dialog.locator(".sentence-completion__answer")).toHaveCount(2);
  await page.locator("#sentence-summary-request").click();
  await expect(page.locator("#sentence-completion-restart")).toBeDisabled();
  await expect(page.locator("#sentence-completion-home")).toBeEnabled();
  await expect(page.locator("#sentence-summary-praise")).toContainText("Verbform verbessert");
  await expect(page.locator("#sentence-summary-request")).toBeHidden();
  await expect(dialog.locator(".sentence-completion__wrong")).toHaveText("listening");
  await expect(dialog.locator(".sentence-completion__right")).toHaveText("listen");
  expect(await dialog.locator(".sentence-completion__wrong").evaluate(node => getComputedStyle(node).textDecorationLine)).toContain("line-through");
  await expect(dialog.locator("#sentence-summary-points li > p i")).toHaveText(["I", "-ing"]);
  await page.reload();
  await expect(page.locator("#sentence-completion")).toBeVisible(); await expect(page.locator("#sentence-summary")).toBeVisible(); expect(api.summaries()).toBe(2);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await dialog.screenshot({ path: info.outputPath(`${mode}-summary-${width}.png`) });
  }
  await page.locator("#sentence-completion-restart").click();
  await expect(dialog).not.toBeVisible(); await expect(page.locator("#sentence-answer")).toHaveValue(""); expect(api.starts()).toBe(2);
});

test("long completion list scrolls while actions remain reachable; Escape returns to the teacher menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await exercise(page, "light", { long: true });
  const body = page.locator(".sentence-completion__body");
  expect(await body.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  for (const selector of ["#sentence-completion-restart", "#sentence-completion-home", "#sentence-summary-request"]) await expect(page.locator(selector)).toBeInViewport();
  await body.focus(); await page.keyboard.press("PageDown");
  await expect.poll(() => body.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press("Escape"); await page.waitForURL("**/teacher*");
});
