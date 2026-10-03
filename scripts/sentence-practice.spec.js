const { test, expect } = require("playwright/test");
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4030";
test.use({ baseURL: BASE_URL, viewport: { width: 1280, height: 850 }, locale: "de-DE", serviceWorkers: "block" });
async function prepare(page, light = false) {
  const set = { id: "sentence-fixture", path: "sets/user/sentence-fixture.json", title: "Words in context", status: "published", sourceLanguage: "de", targetLanguage: "en", sourceLabel: "Deutsch", targetLabel: "Englisch", learningCardCount: 8, cards: [] };
  await page.route("**/api/teacher/session", route => route.fulfill({ json: { session: { teacherId: "julius" }, teacher: { id: "julius" } } }));
  await page.route("**/api/teacher/sets/sentence-fixture", route => route.fulfill({ json: { set } }));
  if (light) await page.addInitScript(() => localStorage.setItem("lerndeck-teacher-appearance-v1", JSON.stringify({ mode: "light" })));
  await page.goto("/?teacherPractice=sentence-fixture");
  await expect(page.locator('[data-mode-key="sentence"].launch-mode-modal__mode-card')).toContainText("Translation");
  await page.locator('[data-mode-key="sentence"].launch-mode-modal__mode-card').click();
  await page.locator("#launch-mode-start").click();
  await expect(page.locator("#launch-settings-title")).toHaveText("Wie viele Sätze möchtest du bilden?");
  await page.locator('.launch-mode-modal__test-count-slider').fill("1");
}
for (const light of [false, true]) test(`sentence feedback, revision, explicit next, completion and responsive appearance (${light ? "light" : "dark"})`, async ({ page }, testInfo) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  let checks = 0;
  let progressWrites = 0;
  const run = { id: "run1", total: 1, position: 1, targetLanguage: "en", prompt: { id: "prompt1", prefix: "Der Zoo ist ", focus: "vorübergehend", suffix: " geschlossen." }, accepted: false, feedback: "", complete: false };
  await page.route("**/api/tablets/**/learning-progress/rounds", route => { progressWrites++; return route.fulfill({ json: {} }); });
  await page.route("**/api/sentence-practice/*", route => {
    const body = route.request().postDataJSON();
    expect(body.tabletId).toBeUndefined();
    const action = route.request().url().split("/").pop();
    if (action === "start") { expect(body.count).toBe(1); return route.fulfill({ json: { run } }); }
    if (action === "check") {
      checks++;
      expect(body.promptId).toBe("prompt1");
      return route.fulfill({ json: { run: { ...run, accepted: checks > 1, feedback: checks === 1 ? "Die Vokabel passt. Achte auf die Form von be." : "Richtig – die Vokabel passt im Satz." } } });
    }
    return route.fulfill({ json: { run: { ...run, accepted: true, complete: true } } });
  });
  await prepare(page, light);
  await expect(page.locator("#launch-settings-start")).toHaveText("Translation starten");
  await page.locator("#launch-settings-start").click();
  await expect(page.locator("#sentence-stage .input-stage__prompt-kicker")).toHaveText("Translation");
  await expect(page.locator("#sentence-prompt strong")).toHaveText("vorübergehend");
  await expect(page.locator("#sentence-stage")).not.toContainText("temporarily");
  await page.locator("#sentence-answer").fill("The zoo are temporarily closed.");
  await page.locator("#sentence-submit").click();
  await expect(page.locator("#sentence-feedback")).toContainText("Form von be");
  await expect(page.locator("#sentence-answer")).toBeEditable();
  await page.locator("#sentence-answer").fill("The zoo is temporarily closed.");
  await expect(page.locator("#sentence-feedback")).toBeHidden();
  await page.locator("#sentence-submit").click();
  await expect(page.locator("#sentence-submit")).toHaveText("Weiter");
  await expect(page.locator("#sentence-answer")).not.toBeEditable();
  await page.screenshot({ path: testInfo.outputPath(`sentence-${light ? "light" : "dark"}.png`) });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("sentence-mobile.png") });
  await page.locator("#sentence-submit").click();
  await expect(page.locator("#sentence-prompt")).toHaveText("Geschafft!");
  expect(progressWrites).toBe(0);
  expect(errors).toEqual([]);
});
test("provider failure preserves the draft, gives neutral feedback and supports retry", async ({ page }) => {
  let attempt = 0;
  await page.route("**/api/sentence-practice/*", route => {
    const action = route.request().url().split("/").pop();
    if (action === "check" && ++attempt === 1) return route.fulfill({ status: 503, json: { error: "Prüfung momentan nicht verfügbar. Bitte erneut versuchen." } });
    return route.fulfill({ json: { run: { id: "run", total: 1, position: 1, targetLanguage: "en", prompt: { id: "prompt", prefix: "Der Zoo ist ", focus: "vorübergehend", suffix: " geschlossen." }, accepted: action === "check", feedback: action === "check" ? "Richtig." : "" } } });
  });
  await prepare(page);
  await page.locator("#launch-settings-start").click();
  await page.locator("#sentence-answer").fill("The zoo is temporarily closed.");
  await page.locator("#sentence-submit").click();
  await expect(page.locator("#sentence-feedback")).toContainText("nicht verfügbar");
  await expect(page.locator("#sentence-answer")).toHaveValue("The zoo is temporarily closed.");
  await expect(page.locator("#sentence-answer")).toHaveAttribute("aria-invalid", "false");
  await page.locator("#sentence-submit").click();
  await expect(page.locator("#sentence-submit")).toHaveText("Weiter");
});
test("tablet session gates paid calls and completed student run counts once without a grade", async ({ page }) => {
  const anonymous = await page.request.post("/api/sentence-practice/start", { data: { setPath: "sets/food-basics-01.json", count: 1 } });
  expect(anonymous.status()).toBe(401);
  let auth = await page.request.post("/api/tablets/rot-1/verify-pin", { data: { pin: "1111" } });
  if (auth.status() === 409) auth = await page.request.post("/api/tablets/rot-1/register", { data: { pin: "1111" } });
  expect(auth.ok()).toBe(true);
  const token = (await auth.json()).session.token;
  const headers = { Authorization: `Bearer ${token}` };
  const subscription = await page.request.post("/api/tablets/rot-1/subscriptions", { headers, data: { setPath: "sets/food-basics-01.json" } });
  expect(subscription.ok()).toBe(true);
  const forbidden = await page.request.post("/api/sentence-practice/start", { headers, data: { tabletId: "rot-1", setPath: "sets/no-access.json", count: 1 } });
  expect(forbidden.status()).toBe(403);
  const unavailable = await page.request.post("/api/sentence-practice/start", { headers, data: { tabletId: "rot-1", setPath: "sets/food-basics-01.json", count: 1 } });
  expect(unavailable.status()).toBe(503); // Local test server has no provider key.
  await page.addInitScript(({ token }) => {
    localStorage.setItem("dino-vocab-device-id-v1", "rot-1");
    localStorage.setItem("dino-vocab-session-unlocked-v1", "1");
    localStorage.setItem("dino-vocab-tablet-session-v1", JSON.stringify({ tabletId: "rot-1", token }));
  }, { token });
  let progressWrites = 0;
  page.on("request", request => {
    if (request.url().includes("learning-progress/rounds")) { progressWrites++; expect(request.postDataJSON().modeKey).toBe("sentence"); expect(request.postDataJSON().lastRoundPercent).toBeNull(); }
  });
  const base = { id: "pupil-run", total: 1, position: 1, targetLanguage: "en", prompt: { id: "pupil-prompt", prefix: "Die ", focus: "Zutat", suffix: " ist frisch." }, accepted: false, feedback: "", complete: false };
  await page.route("**/api/sentence-practice/*", route => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    expect(route.request().postDataJSON().tabletId).toBe("rot-1");
    const action = route.request().url().split("/").pop();
    return route.fulfill({ json: { run: { ...base, accepted: action !== "start", complete: action === "next" || action === "resume" } } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /^Food Basics/ }).click();
  await page.locator('[data-mode-key="sentence"].launch-mode-modal__mode-card').click();
  await page.locator("#launch-mode-start").click();
  await page.locator('.launch-mode-modal__test-count-slider').fill("1");
  await page.locator("#launch-settings-start").click();
  await page.locator("#sentence-answer").fill("The ingredient is fresh.");
  await page.locator("#sentence-submit").click();
  await page.locator("#sentence-submit").click();
  await expect(page.locator("#sentence-prompt")).toHaveText("Geschafft!");
  expect(progressWrites).toBe(1);
  await page.reload();
  await expect(page.locator("#sentence-prompt")).toHaveText("Geschafft!");
  expect(progressWrites).toBe(1);
});

for (const light of [false, true]) test(`specific feedback highlights only the problem and selects it for revision (${light ? "light" : "dark"})`, async ({ page }, testInfo) => {
  const answer = "Breakfast ist included\n.";
  let checks = 0;
  const run = { id: "localized-run", total: 1, position: 1, targetLanguage: "en", prompt: { id: "localized-prompt", prefix: "Das Frühstück ist ", focus: "inklusive", suffix: "." }, accepted: false, feedback: "", status: "ready", problem: null };
  await page.route("**/api/sentence-practice/*", route => {
    const action = route.request().url().split("/").pop();
    if (action === "check") {
      checks++;
      if (checks === 3) return route.fulfill({ status: 503, json: { error: "Prüfung momentan nicht verfügbar. Bitte erneut versuchen." } });
      if (checks === 4) return route.fulfill({ json: { run: { ...run, accepted: true, status: "accepted", feedback: "Richtig.", problem: null } } });
      return route.fulfill({ json: { run: { ...run, status: "revise", checkedAnswer: answer, problem: { start: 10, end: 13 }, feedback: "Die Vokabel passt. ‚ist‘ ist noch Deutsch; überprüfe die englische Verbform." } } });
    }
    return route.fulfill({ json: { run } });
  });
  await prepare(page, light);
  await page.locator("#launch-settings-start").click();
  await page.locator("#sentence-answer").fill("  " + answer);
  await page.locator("#sentence-submit").click();
  await expect(page.locator("#sentence-feedback-text")).toContainText("‚ist‘ ist noch Deutsch");
  await expect(page.locator(".sentence-stage__feedback-label")).toHaveText("Feedback:");
  const mark = page.locator(".sentence-stage__problem");
  await expect(mark).toHaveText("ist");
  expect(await mark.evaluate(el => getComputedStyle(el).textDecorationStyle)).toBe("wavy");
  await page.screenshot({ path: testInfo.outputPath("localized-feedback.png") });
  await mark.click();
  await expect(page.locator("#sentence-answer")).toBeFocused();
  expect(await page.locator("#sentence-answer").evaluate(el => el.value.slice(el.selectionStart, el.selectionEnd))).toBe("ist");
  expect(checks).toBe(1);
  await page.keyboard.type("is");
  await expect(page.locator("#sentence-feedback")).toBeHidden();
  await expect(mark).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#sentence-answer").fill(answer);
  await page.locator("#sentence-submit").click();
  await expect(mark).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("localized-feedback-mobile.png") });
  await page.locator("#sentence-submit").click();
  await expect(page.locator("#sentence-feedback-text")).toContainText("nicht verfügbar");
  await expect(mark).toHaveCount(0);
  await expect(page.locator("#sentence-answer")).toHaveAttribute("aria-invalid", "false");
  await page.locator("#sentence-answer").fill("Breakfast is included.");
  await page.locator("#sentence-submit").click();
  await expect(page.locator("#sentence-submit")).toHaveText("Weiter");
  await expect(mark).toHaveCount(0);
});

for (const light of [false,true]) test(`difficulty and optional transfer help (${light ? 'light':'dark'})`,async({page},testInfo)=>{
  const run={id:'help-run',total:2,position:1,difficulty:'hard',targetLanguage:'en',prompt:{id:'help-prompt',prefix:'Die Fähre kommt ',focus:'jeden Tag',suffix:'.'},accepted:false,status:'ready',feedback:'',help:null,shown:false};
  let shown=0;
  await page.route('**/api/sentence-practice/*',route=>{
    const action=route.request().url().split('/').pop();
    const body=route.request().postDataJSON();
    if(action==='start'){ expect(body.difficulty).toBe('hard');expect(body.count).toBe(2);return route.fulfill({json:{run}}); }
    if(action==='shown'){shown++;expect(body.promptId).toBe('help-prompt');return route.fulfill({json:{run:{...run,shown:true}}});}
    return route.fulfill({json:{run:{...run,shown:true,status:'revise',checkedAnswer:'The ferry come every day.',feedback:'Fast da! 🔎 Die Häufigkeit stimmt. Prüfe die Verbform bei „come“: Die Fähre steht in der Einzahl.',problem:{start:10,end:14},help:{explanation:'Bei he, she, it verändert sich im einfachen Präsens die Verbform. Überlege, welche Form zu einem einzelnen Subjekt passt.',example:'The dog plays in the park.'}}}});
  });
  await prepare(page,light);
  await expect(page.getByRole('radio',{name:/Einfach/})).toBeChecked();
  await page.getByText('Schwer',{exact:true}).click();
  await expect(page.getByRole('radio',{name:/Schwer/})).toBeChecked();
  await page.getByRole('radio',{name:/Schwer/}).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('radio',{name:/Mittel/})).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await page.locator('.launch-mode-modal__test-count-slider').fill('2');
  await page.screenshot({path:testInfo.outputPath('sentence-settings.png')});
  await page.locator('#launch-settings-start').click();
  await page.locator('#sentence-answer').fill('The ferry come every day.');
  await page.locator('#sentence-submit').click();
  await expect(page.locator('#sentence-help')).not.toHaveAttribute('open','');
  await expect(page.locator('#sentence-help-example')).toBeHidden();
  await page.getByText('Mehr Hilfe',{exact:true}).click();
  await expect(page.locator('#sentence-help-example')).toHaveText('The dog plays in the park.');
  await page.screenshot({path:testInfo.outputPath('sentence-help.png')});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('sentence-help-mobile.png'),fullPage:true});
  await page.locator('#sentence-answer').fill('The ferry comes every day.');
  await expect(page.locator('#sentence-feedback')).toBeHidden();
  await expect(page.locator('#sentence-help')).not.toHaveAttribute('open','');
  expect(shown).toBe(1);
});
