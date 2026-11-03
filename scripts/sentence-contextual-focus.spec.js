const { test, expect } = require("./teacher-release-fixture.cjs");
test.use({ baseURL: process.env.BASE_URL || "http://127.0.0.1:4030", viewport: { width: 1280, height: 850 }, locale: "de-DE", serviceWorkers: "block" });

for (const theme of ["light", "dark"]) for (const embedded of [false, true]) test(`failed sentence start shows the actual error and permits retry (${theme}, embedded=${embedded})`, async ({ page }) => {
  await page.addInitScript(theme => localStorage.setItem("lerndeck-teacher-appearance-v1", JSON.stringify({ mode: theme })), theme);
  const set = { id: "start-error", path: "sets/user/start-error.json", title: "Translation", status: "published", sourceLanguage: "de", targetLanguage: "en", sourceLabel: "Deutsch", targetLabel: "Englisch", learningCardCount: 1, cards: [] };
  const run = { id: "retry-run", total: 1, position: 1, difficulty: "easy", targetLanguage: "en", prompt: { id: "retry-prompt", prefix: "Das ", focus: "Auto", suffix: " ist blau." }, accepted: false, shown: true, history: [] };
  await page.route("**/api/teacher/session", route => route.fulfill({ json: { session: { teacherId: "julius" }, teacher: { id: "julius" } } }));
  await page.route("**/api/teacher/sets/start-error", route => route.fulfill({ json: { set } }));
  let starts = 0;
  await page.route("**/api/sentence-practice/*", route => {
    expect(route.request().headers()["x-lerndeck-embed"]).toBe(embedded ? "tafelraum" : undefined);
    if (route.request().url().endsWith("/start") && ++starts === 1) return route.fulfill({ status: 503, json: { error: "Satz konnte nicht vorbereitet werden. Bitte erneut versuchen." } });
    return route.fulfill({ json: { run } });
  });
  await page.goto("/?teacherPractice=start-error" + (embedded ? "&embed=tafelraum" : ""));
  await page.locator('[data-mode-key="sentence"].launch-mode-modal__mode-card').click();
  await page.locator("#launch-mode-start").click();
  await page.locator("#launch-settings-start").click();
  await expect(page.locator("#sentence-submit")).toHaveText("Erneut versuchen");
  await expect(page.locator("#sentence-feedback-notice")).toHaveText("Satz konnte nicht vorbereitet werden. Bitte erneut versuchen.");
  await expect(page.locator("#sentence-feedback-text")).not.toContainText("Bitte kurz warten");
  await page.locator("#sentence-submit").click();
  await expect(page.locator("#sentence-prompt")).toHaveText("Das Auto ist blau.");
  await expect(page.locator("#sentence-feedback-notice")).toBeHidden();
  expect(starts).toBe(2);
});

for (const theme of ["light", "dark"]) test(`contextual vocabulary is marked literally and retained on reload (${theme})`, async ({ page }, info) => {
  await page.addInitScript(theme => localStorage.setItem("lerndeck-teacher-appearance-v1", JSON.stringify({ mode: theme })), theme);
  const set = { id: "contextual-fixture", path: "sets/user/contextual-fixture.json", title: "Vokabeln im Kontext", status: "published", sourceLanguage: "de", targetLanguage: "en", sourceLabel: "Deutsch", targetLabel: "Englisch", learningCardCount: 1, cards: [] };
  const run = { id: "contextual-run", total: 1, position: 1, difficulty: "easy", targetLanguage: "en", prompt: { id: "surface-prompt", prefix: "Der Korb ist aus ", focus: "geflochtenem Material", suffix: "." }, accepted: false, shown: true, history: [] };
  await page.route("**/api/teacher/session", route => route.fulfill({ json: { session: { teacherId: "julius" }, teacher: { id: "julius" } } }));
  await page.route("**/api/teacher/sets/contextual-fixture", route => route.fulfill({ json: { set } }));
  await page.route("**/api/sentence-practice/*", route => route.fulfill({ json: { run } }));
  await page.goto("/?teacherPractice=contextual-fixture");
  await page.locator('[data-mode-key="sentence"].launch-mode-modal__mode-card').click();
  await page.locator("#launch-mode-start").click();
  await page.locator("#launch-settings-start").click();
  await expect(page.locator("#sentence-prompt")).toHaveText("Der Korb ist aus geflochtenem Material.");
  await expect(page.locator("#sentence-prompt strong")).toHaveText("geflochtenem Material");
  await page.locator("#sentence-answer").fill("The basket is made of wicker.");
  await page.reload();
  await expect(page.locator("#sentence-prompt strong")).toHaveText("geflochtenem Material");
  await expect(page.locator("#sentence-answer")).toHaveValue("The basket is made of wicker.");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#sentence-stage .input-stage__card").screenshot({ path: info.outputPath(`contextual-${theme}-${width}.png`) });
  }
  Object.assign(run, { prompt: { id: "separated-prompt", prefix: "Das Frühstück ist im Preis ", focus: "enthalten", suffix: "." } });
  await page.reload();
  await expect(page.locator("#sentence-prompt")).toHaveText("Das Frühstück ist im Preis enthalten.");
  await expect(page.locator("#sentence-prompt strong")).toHaveText("enthalten");
});

for (const theme of ["light", "dark"]) test(`waiting for an answer check preserves the draft and feedback (${theme})`, async ({ page }, info) => {
  await page.addInitScript(theme => localStorage.setItem("lerndeck-teacher-appearance-v1", JSON.stringify({ mode: theme })), theme);
  const set = { id: "waiting-fixture", path: "sets/user/waiting-fixture.json", title: "Translation", status: "published", sourceLanguage: "de", targetLanguage: "en", sourceLabel: "Deutsch", targetLabel: "Englisch", learningCardCount: 1, cards: [] };
  const run = { id: "waiting-run", total: 1, position: 1, difficulty: "easy", targetLanguage: "en", prompt: { id: "waiting-prompt", prefix: "Das ", focus: "Auto", suffix: " ist blau." }, accepted: false, shown: true, history: [{ id: "earlier", answer: "The car are blue.", status: "revise", feedback: "Die Vokabel passt 👍 Prüfe die Verbform.", issues: [], help: null }] };
  await page.route("**/api/teacher/session", route => route.fulfill({ json: { session: { teacherId: "julius" }, teacher: { id: "julius" } } }));
  await page.route("**/api/teacher/sets/waiting-fixture", route => route.fulfill({ json: { set } }));
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route("**/api/sentence-practice/*", async route => {
    if (route.request().url().endsWith("/check")) {
      await held;
      await route.fulfill({ json: { run: { ...run, accepted: true, status: "accepted", checkedAnswer: "The car is blue.", feedback: "Das passt 👍", history: [...run.history, { id: "accepted", answer: "The car is blue.", status: "accepted", feedback: "Das passt 👍", issues: [], help: null }] } } });
    } else await route.fulfill({ json: { run } });
  });
  await page.goto("/?teacherPractice=waiting-fixture");
  await page.locator('[data-mode-key="sentence"].launch-mode-modal__mode-card').click();
  await page.locator("#launch-mode-start").click();
  await page.locator("#launch-settings-start").click();
  await page.locator("#sentence-answer").fill("The car is blue.");
  await page.locator("#sentence-submit").click();
  await expect(page.locator("#sentence-feedback-notice")).toHaveText("Bitte kurz warten – deine Anfrage wird bearbeitet.");
  await expect(page.locator("#sentence-answer")).toHaveValue("The car is blue.");
  await expect(page.locator("#sentence-answer")).toBeDisabled();
  await expect(page.locator("#sentence-submit")).toBeDisabled();
  await expect(page.locator("#sentence-feedback-list")).toContainText("The car are blue.");
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#sentence-stage .input-stage__card").screenshot({ path: info.outputPath(`waiting-${theme}-390.png`) });
  release();
  await expect(page.locator("#sentence-submit")).toHaveText("Weiter");
  await expect(page.locator("#sentence-feedback-notice")).toBeHidden();
  await expect(page.locator("#sentence-answer")).toHaveValue("The car is blue.");
});
