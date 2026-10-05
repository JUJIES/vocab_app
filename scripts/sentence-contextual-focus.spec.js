const { test, expect } = require("./teacher-release-fixture.cjs");
test.use({ baseURL: process.env.BASE_URL || "http://127.0.0.1:4030", viewport: { width: 1280, height: 850 }, locale: "de-DE", serviceWorkers: "block" });

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
