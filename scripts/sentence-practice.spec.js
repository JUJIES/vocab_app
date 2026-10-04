const { test, expect } = require("playwright/test");
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4030";
test.use({ baseURL: BASE_URL, viewport: { width: 1280, height: 850 }, locale: "de-DE", serviceWorkers: "block" });
// Mirror the API's canonical, validated history rather than inventing it in the UI.
function checked(run, answer, feedback, accepted = false, problem = null, help = null) {
  const status = accepted ? 'accepted' : 'revise';
  const history = run.history || [];
  const issues = accepted ? [] : [{quote: problem ? answer.trim().slice(problem.start,problem.end) : null, message: feedback, problem}];
  const entry = { id: `attempt-${history.length + 1}`, answer: answer.trim(), feedback, status, issues, help };
  const updated = { ...run, accepted, status, checkedAnswer: answer.trim(), feedback, issues, help,
    history: history.at(-1)?.answer === answer.trim() ? history : [...history, entry] };
  Object.assign(run, updated);
  return updated;
}
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
for (const light of [false, true]) test(`language forms remain distinct across feedback, issues, help and history (${light ? "light" : "dark"})`, async ({ page }, info) => {
  const entry = {
    id: "forms1", answer: "I often listening to musik.", status: "revise",
    feedback: "Die Angabe `often` ist passend übersetzt 👍 Bei `listening` fehlt noch die passende Verbform.",
    issues: [{ quote: "listening", problem: { start: 8, end: 17 }, message: "Verbform: Bei `I` steht die Grundform. Eine Form von `to have` wäre hier kein passendes Hilfsverb." }, { quote: "musik", problem: { start: 21, end: 26 }, message: "Rechtschreibung: Prüfe „musik“ noch einmal." }],
    help: { explanation: "Bei `he`, `she` und `it` gilt eine andere Endung. Der Ausdruck “He ist nicht” wäre teilweise Deutsch.", example: "She reads on Sundays." },
  };
  const run = { id: "forms", total: 1, position: 1, targetLanguage: "en", prompt: { id: "forms-prompt", prefix: "Ich höre ", focus: "oft", suffix: " Musik." }, accepted: false, shown: true, history: [] };
  await page.route("**/api/sentence-practice/*", route => {
    if (route.request().url().endsWith("/check")) Object.assign(run, { history: [entry], status: "revise", feedback: entry.feedback, checkedAnswer: entry.answer, issues: entry.issues, help: entry.help });
    return route.fulfill({ json: { run } });
  });
  await prepare(page, light);
  await page.locator("#launch-settings-start").click();
  await page.locator("#sentence-answer").fill(entry.answer);
  await page.locator("#sentence-submit").click();
  const body = page.locator(".sentence-stage__feedback-body");
  await expect(body.locator("p").first().locator("i")).toHaveText(["often", "listening"]);
  await expect(body.locator(".sentence-stage__issues .sentence-stage__language-form")).toHaveText(["listening", "I", "to have", "musik", "musik"]);
  await expect(page.locator("#sentence-feedback-text")).not.toContainText("`");
  await page.locator(".sentence-stage__help summary").click();
  await expect(body.locator(".sentence-stage__help > p i")).toHaveText(["he", "she", "it", "He ist nicht"]);
  await expect(body.locator(".sentence-stage__example p")).toHaveText("She reads on Sundays.");
  const form = body.locator("i").first();
  expect(await form.evaluate(node => getComputedStyle(node).fontStyle)).toBe("italic");
  expect(Number(await form.evaluate(node => getComputedStyle(node).fontWeight))).toBeGreaterThanOrEqual(600);
  expect(await body.locator("a, img, code, button").count()).toBe(0);
  await page.reload();
  await expect(page.locator(".sentence-stage__feedback-body p").first().locator("i")).toHaveText(["often", "listening"]);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.locator(".sentence-stage__help summary").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#sentence-stage .input-stage__card").screenshot({ path: info.outputPath(`language-forms-${light ? "light" : "dark"}-${width}.png`) });
  }
});
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
      return route.fulfill({ json: { run: { ...checked(run, body.answer, checks === 1 ? "Die Vokabel passt. Achte auf die Form von be." : "Richtig – die Vokabel passt im Satz.", checks > 1) } } });
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
  await expect(page.locator("#sentence-feedback")).toBeVisible();
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
test("uncertain feedback stays neutral and is preserved when editing", async ({ page }) => {
  const run = { id: "uncertain-run", total: 1, position: 1, targetLanguage: "en", prompt: { id: "uncertain-prompt", prefix: "Der Zoo ist ", focus: "vorübergehend", suffix: " geschlossen." }, accepted: false, status: "ready", feedback: "", history: [], shown: true };
  await page.route("**/api/sentence-practice/*", route => {
    if (route.request().url().endsWith("/check")) {
      const feedback = "Ich bin mir bei der Prüfung nicht sicher. Bitte frage deine Lehrkraft. 🔎";
      const answer = route.request().postDataJSON().answer;
      Object.assign(run, { status: "uncertain", checkedAnswer: answer, feedback, issues: [], history: [{ id: "uncertain-attempt", answer, feedback, status: "uncertain", issues: [], help: null }] });
    }
    return route.fulfill({ json: { run } });
  });
  await prepare(page);
  await page.locator("#launch-settings-start").click();
  await page.locator("#sentence-answer").fill("The zoo is temporarily closed.");
  await page.locator("#sentence-submit").click();
  await expect(page.locator(".sentence-stage__feedback-result")).toHaveText("Nicht sicher");
  await expect(page.locator("#sentence-answer")).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator("#sentence-submit")).toHaveText("Prüfen");
  await page.locator("#sentence-answer").fill("The zoo is temporarily closed!");
  await expect(page.locator(".sentence-stage__feedback-result")).toHaveText("Nicht sicher");
  await expect(page.locator("button.sentence-stage__problem")).toHaveCount(0);
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
    if (action === "check") checked(base, route.request().postDataJSON().answer, "🌟 Die Aussage stimmt.", true);
    if (action === "next") { base.complete = true; base.completion = { sentences: [{ promptId: base.prompt.id, sourceSentence: "Die Zutat ist frisch.", answer: "The ingredient is fresh.", attemptCount: 1 }], summary: null }; }
    if (action === "summary") base.completion.summary = { praise: "Du hast den Satz gleich passend übersetzt 👍", points: [] };
    return route.fulfill({ json: { run: base } });
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
  await expect(page.locator('.sentence-stage__feedback-excerpt')).toHaveText('The ingredient is fresh.');
  expect(progressWrites).toBe(1);
  await expect(page.locator('#sentence-completion-home')).toHaveText('Hauptmenü');
  await expect(page.locator('.sentence-completion__count')).toHaveText('1 Versuch');
  await page.locator('#sentence-summary-request').click();
  await expect(page.locator('#sentence-summary-praise')).toContainText('gleich passend übersetzt');
  expect(progressWrites).toBe(1);
  await page.reload();
  await expect(page.locator("#sentence-prompt")).toHaveText("Geschafft!");
  await expect(page.locator('.sentence-stage__feedback-excerpt')).toHaveText('The ingredient is fresh.');
  expect(progressWrites).toBe(1);
});

for (const light of [false, true]) test(`specific feedback highlights only the problem and selects it for revision (${light ? "light" : "dark"})`, async ({ page }, testInfo) => {
  const answer = "Breakfast ist included\n.";
  let checks = 0;
  const run = { id: "localized-run", total: 1, position: 1, targetLanguage: "en", prompt: { id: "localized-prompt", prefix: "Das Frühstück ist ", focus: "inklusive", suffix: "." }, accepted: false, feedback: "", status: "ready", issues: [] };
  await page.route("**/api/sentence-practice/*", route => {
    const action = route.request().url().split("/").pop();
    if (action === "check") {
      checks++;
      if (checks === 3) return route.fulfill({ status: 503, json: { error: "Prüfung momentan nicht verfügbar. Bitte erneut versuchen." } });
      if (checks === 4) return route.fulfill({ json: { run: { ...checked(run, route.request().postDataJSON().answer, "Richtig.", true) } } });
      return route.fulfill({ json: { run: { ...checked(run, answer, "Die Vokabel passt. ‚ist‘ ist noch Deutsch; überprüfe die englische Verbform.", false, { start: 10, end: 13 }) } } });
    }
    return route.fulfill({ json: { run } });
  });
  await prepare(page, light);
  await page.locator("#launch-settings-start").click();
  await page.locator("#sentence-answer").fill("  " + answer);
  await page.locator("#sentence-submit").click();
  await expect(page.locator("#sentence-feedback-text")).toContainText("‚ist‘ ist noch Deutsch");
  await expect(page.locator(".sentence-stage__feedback-label")).toHaveText("Feedback");
  const mark = page.locator("button.sentence-stage__problem");
  await expect(mark).toHaveText("ist");
  expect(await mark.evaluate(el => getComputedStyle(el).textDecorationStyle)).toBe("wavy");
  await page.screenshot({ path: testInfo.outputPath("localized-feedback.png") });
  await mark.click();
  await expect(page.locator("#sentence-answer")).toBeFocused();
  expect(await page.locator("#sentence-answer").evaluate(el => el.value.slice(el.selectionStart, el.selectionEnd))).toBe("ist");
  expect(checks).toBe(1);
  await page.keyboard.type("is");
  await expect(page.locator("#sentence-feedback")).toBeVisible();
  await expect(mark).toHaveCount(0);
  await expect(page.locator("span.sentence-stage__problem")).toHaveText("ist");
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
    return route.fulfill({json:{run:{...checked(run,'The ferry come every day.','Fast da! 🔎 Die Häufigkeit stimmt. Prüfe die Verbform bei „come“: Die Fähre steht in der Einzahl.',false,{start:10,end:14},{explanation:'Bei he, she, it verändert sich im einfachen Präsens die Verbform. Überlege, welche Form zu einem einzelnen Subjekt passt.',example:'The dog plays in the park.'}),shown:true}}});
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
  await expect(page.locator('.sentence-stage__help')).not.toHaveAttribute('open','');
  await expect(page.locator('.sentence-stage__example > p')).toBeHidden();
  await page.getByText('Mehr Hilfe',{exact:true}).click();
  await expect(page.locator('.sentence-stage__example > p')).toHaveText('The dog plays in the park.');
  await page.screenshot({path:testInfo.outputPath('sentence-help.png')});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('sentence-help-mobile.png'),fullPage:true});
  await page.locator('#sentence-answer').fill('The ferry comes every day.');
  await expect(page.locator('#sentence-feedback')).toBeVisible();
  await expect(page.locator('.sentence-stage__help')).toHaveAttribute('open','');
  await expect(page.locator('.sentence-stage__feedback-excerpt')).toHaveText('The ferry come every day.');
  expect(shown).toBe(1);
});

for (const light of [false, true]) test(`revision history survives edits, retries and reload, then resets (${light ? 'light' : 'dark'})`, async ({ page, browserName }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const run = { id: 'history-run', total: 2, position: 1, targetLanguage: 'en', prompt: { id: 'history-prompt', prefix: 'Mein Fahrrad hat einen ', focus: 'platten Reifen', suffix: '.' }, accepted: false, status: 'ready', feedback: '', history: [], shown: true };
  let failNext = false;
  await page.route('**/api/sentence-practice/*', route => {
    const action = route.request().url().split('/').pop();
    const body = route.request().postDataJSON();
    if (action === 'check') {
      if (failNext) { failNext = false; return route.fulfill({ status: 503, json: { error: 'Prüfung momentan nicht verfügbar. Bitte erneut versuchen.' } }); }
      const answer = body.answer.trim();
      if (answer === 'My car has a flat type.') checked(run, answer, '🔎 Die Aussage ist erkennbar. Prüfe das Fahrzeug und die Schreibweise der Zielvokabel.', false, { start: 18, end: 22 }, { explanation: 'Lies die Aufgabe noch einmal: Welches Fahrzeug ist gemeint?', example: null });
      else if (answer === 'My car has a flat tire.') checked(run, answer, '👍 Die Schreibweise passt jetzt! Prüfe noch das Fahrzeug: Ist es dasselbe wie in der Aufgabe?', false, { start: 3, end: 6 });
      else checked(run, answer, '🌟 Jetzt stimmt auch das Fahrzeug. Dein Satz passt!', true);
    }
    if (action === 'next') Object.assign(run, { position: 2, prompt: { id: 'history-prompt-2', prefix: 'Der Zoo ist ', focus: 'vorübergehend', suffix: ' geschlossen.' }, accepted: false, status: 'ready', feedback: '', history: [], checkedAnswer: '', help: null, issues: [] });
    return route.fulfill({ json: { run } });
  });
  await prepare(page, light);
  await page.locator('.launch-mode-modal__test-count-slider').fill('2');
  await page.locator('#launch-settings-start').click();
  const entries = page.locator('.sentence-stage__feedback-entry');
  const quotes = page.locator('.sentence-stage__feedback-excerpt');
  const active = page.locator('.sentence-stage__feedback-entry:visible');
  const previous = page.getByRole('button', { name: 'Vorheriges Feedback' });
  const next = page.getByRole('button', { name: 'Nächstes Feedback' });
  const position = page.locator('#sentence-feedback-position');
  await page.locator('#sentence-answer').fill('My car has a flat type.');
  await page.locator('#sentence-submit').click();
  await expect(entries).toHaveCount(1);
  await expect(active).toHaveCount(1);
  await expect(active.locator('.sentence-stage__submission-header')).toContainText('Dein Satz:');
  await expect(page.locator('#sentence-feedback-nav')).toBeHidden();
  await expect(entries.first()).toHaveClass(/feedback-entry--new/);
  await expect(entries.first().locator(".sentence-stage__submission > blockquote")).toHaveText("My car has a flat type.");
  await expect(entries.first().locator(":scope > .sentence-stage__feedback-body")).toContainText(run.feedback);
  await expect(entries.first().locator(".sentence-stage__feedback-body blockquote")).toHaveCount(0);
  await page.getByText('Mehr Hilfe', { exact: true }).click();
  await page.locator('#sentence-answer').fill('My car has a flat tire.');
  await expect(quotes).toHaveText(['My car has a flat type.']);
  await expect(entries.first().locator('details')).toHaveAttribute('open', '');
  await expect(page.locator('button.sentence-stage__problem')).toHaveCount(0);
  await page.locator('#sentence-submit').click();
  await expect(entries).toHaveCount(2);
  await expect(entries.first().locator('details')).toHaveAttribute('open', '');
  await expect(quotes).toHaveText(['My car has a flat type.', 'My car has a flat tire.']);
  await expect(active).toHaveCount(1);
  await expect(active.locator('blockquote')).toHaveText('My car has a flat tire.');
  await expect(position).toHaveText('Feedback 2 von 2');
  await expect(position).toHaveClass('visually-hidden');
  await expect(page.locator('.sentence-stage__feedback-position > span').first()).toHaveText('Dein Feedback');
  await expect(page.locator('#sentence-feedback-nav small')).toHaveCount(0);
  await expect(next).toBeDisabled();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('translation-revision-tablet.png'), fullPage: true });
  await previous.click();
  expect(await page.locator('#sentence-feedback-list').evaluate(list => list.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  await expect(active.locator('blockquote')).toHaveText('My car has a flat type.');
  await expect(position).toHaveText('Feedback 1 von 2');
  await expect(previous).toBeDisabled();
  await expect(active.locator('details')).toHaveAttribute('open', '');
  await expect(active.locator('button.sentence-stage__problem')).toHaveCount(0);
  await expect(page.locator('#sentence-answer')).toHaveValue('My car has a flat tire.');
  await page.locator('#sentence-feedback-list').focus();
  await page.keyboard.press('ArrowRight');
  await expect(position).toHaveText('Feedback 2 von 2');
  await expect(active.locator('button.sentence-stage__problem')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await expect(position).toHaveText('Feedback 2 von 2');
  await page.keyboard.press('ArrowLeft');
  await expect(position).toHaveText('Feedback 1 von 2');
  await page.locator('#sentence-submit').click();
  await expect(entries).toHaveCount(2);
  await expect(position).toHaveText('Feedback 1 von 2');
  failNext = true;
  await page.locator('#sentence-answer').fill('My bike has a flat tire.');
  await page.locator('#sentence-submit').click();
  await expect(page.locator('#sentence-feedback-notice')).toContainText('nicht verfügbar');
  await expect(entries).toHaveCount(2);
  await expect(position).toHaveText('Feedback 1 von 2');
  await expect(active).toHaveCount(1);
  await page.locator('#sentence-answer').fill('My bike has a flat tire!');
  // Draft saving and resuming use the existing run; the server history is authoritative.
  await page.reload();
  await expect(entries).toHaveCount(2);
  await expect(page.locator('#sentence-answer')).toHaveValue('My bike has a flat tire!');
  await expect(position).toHaveText('Feedback 2 von 2');
  await expect(active).toHaveCount(1);
  await expect(entries.first()).not.toHaveClass(/feedback-entry--new/);
  await expect(page.locator('button.sentence-stage__problem')).toHaveCount(0);
  await page.locator('#sentence-submit').click();
  await expect(entries).toHaveCount(3);
  await expect(page.locator('#sentence-submit')).toHaveText('Weiter');
  await expect(quotes).toHaveText(['My car has a flat type.', 'My car has a flat tire.', 'My bike has a flat tire!']);
  await expect(page.locator('#sentence-feedback-notice')).toBeHidden();
  await expect(position).toHaveText('Feedback 3 von 3');
  await expect(active).toHaveCount(1);
  await expect(active.locator('.sentence-stage__feedback-result')).toHaveText('Passt');
  await expect(page.locator('#sentence-answer')).toHaveValue('My bike has a flat tire!');
  // Desktop mouse drags select text rather than browsing feedback.
  const box = await active.locator('blockquote').boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 10);
  await page.mouse.up();
  await expect(position).toHaveText('Feedback 3 von 3');
  await page.evaluate(() => window.getSelection().removeAllRanges());
  // Chromium exercises native touch; WebKit receives touch pointer events
  // with real capture, without stubbing the navigation handler.
  const touch = browserName === 'chromium' ? await page.context().newCDPSession(page) : null;
  if (touch) await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  async function swipe(dx, dy = 0, cancel = false, duringGesture = null, horizontalStart = false) {
    await expect.poll(() => page.locator('#sentence-feedback-list').evaluate(list => list.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
    const area = await active.locator('.sentence-stage__submission-header').boundingBox();
    const x = area.x + area.width / 2, y = area.y + area.height / 2;
    const before = await position.textContent();
    async function checkFingerFollow() {
      if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.4) return;
      await expect.poll(() => active.evaluate(item => Math.abs(new DOMMatrixReadOnly(getComputedStyle(item).transform).m41))).toBeGreaterThan(0);
      await expect(position).toHaveText(before);
    }
    if (touch) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 4; step++) {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 4, y: y + (horizontalStart && step === 1 ? 0 : dy * step / 4) }] });
      }
      await checkFingerFollow();
      if (duringGesture) { await duringGesture(); await checkFingerFollow(); }
      await touch.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
      return;
    }
    await page.evaluate(() => {
      window.feedbackPointerId = null;
      document.addEventListener('pointerdown', event => { window.feedbackPointerId = event.pointerId; }, { once: true });
    });
    await page.mouse.move(x, y);
    await page.mouse.down();
    const pointerId = await page.evaluate(() => window.feedbackPointerId);
    const options = { pointerId, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y };
    await page.locator('#sentence-feedback-list').dispatchEvent('pointerdown', options);
    if (horizontalStart) await page.locator('#sentence-feedback-list').dispatchEvent('pointermove', { ...options, clientX: x + dx / 4 });
    await page.locator('#sentence-feedback-list').dispatchEvent('pointermove', { ...options, clientX: x + dx, clientY: y + dy });
    await checkFingerFollow();
    if (duringGesture) { await duringGesture(); await checkFingerFollow(); }
    await page.locator('#sentence-feedback-list').dispatchEvent(cancel ? 'pointercancel' : 'pointerup', { ...options, clientX: x + dx, clientY: y + dy });
    await page.mouse.up();
  }
  await page.locator('#sentence-answer').focus();
  await page.locator('#sentence-answer').evaluate(input => input.setSelectionRange(0, 7));
  // Tablet browser chrome/keyboard can resize the height while a finger is down.
  await swipe(90, 0, false, async () => {
    const width = await page.locator('#sentence-feedback-list').evaluate(list => list.clientWidth);
    // Changing Playwright's device metrics cancels the native touch itself.
    // Deliver the resize notification directly, keeping the real finger down.
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    expect(await page.locator('#sentence-feedback-list').evaluate(list => list.clientWidth)).toBe(width);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  });
  await expect(position).toHaveText('Feedback 2 von 3');
  // Direction is locked at the beginning, not decided again at release.
  await swipe(-90, 70, false, null, true);
  await expect(position).toHaveText('Feedback 3 von 3');
  await swipe(10);
  await swipe(70, 120);
  await swipe(90, 0, true);
  await expect(position).toHaveText('Feedback 3 von 3');
  await expect.poll(() => active.evaluate(item => item.style.transform)).toBe('');
  await page.locator('#sentence-feedback-list').focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(position).toHaveText('Feedback 1 von 3');
  await page.keyboard.press('ArrowRight');
  await page.setViewportSize({ width: 1000, height: 768 });
  await expect(position).toHaveText('Feedback 2 von 3');
  await page.keyboard.press('ArrowRight');
  await expect(position).toHaveText('Feedback 3 von 3');
  await expect.poll(() => page.locator('#sentence-feedback-list').evaluate(list => list.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`translation-history-${light ? 'light' : 'dark'}.png`), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await previous.click();
  await expect(position).toHaveText('Feedback 2 von 3');
  expect(await page.locator('#sentence-feedback-list').evaluate(list => list.getAnimations({ subtree: true }).length)).toBe(0);
  await next.click();
  await expect(position).toHaveText('Feedback 3 von 3');
  expect(await entries.last().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('translation-history-mobile.png'), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await previous.click();
  await page.locator('#sentence-submit').click();
  await expect(entries).toHaveCount(0);
  await expect(page.locator('#sentence-feedback')).toBeHidden();
  await expect(page.locator('#sentence-prompt strong')).toHaveText('vorübergehend');
  expect(errors).toEqual([]);
});

for (const light of [false, true]) test(`structured points and several exact correction marks (${light ? 'light' : 'dark'})`, async ({ page }, testInfo) => {
  const errors=[];page.on('pageerror', error=>errors.push(error.message));
  const initial='I often listening to musik when i make homeworks.';
  const run={id:'multi-run',total:1,position:1,targetLanguage:'en',prompt:{id:'multi-prompt',prefix:'Ich höre oft ',focus:'Musik',suffix:', während ich Hausaufgaben mache.'},accepted:false,status:'ready',feedback:'',history:[],issues:[],shown:true};
  let checks=0;
  await page.route('**/api/sentence-practice/*',route=>{
    const action=route.request().url().split('/').pop();
    if(action==='check'){
      const answer=route.request().postDataJSON().answer.trim();checks++;
      const points=checks===1 ? [
        ['listening','Verbform: Often beschreibt eine Gewohnheit. Dafür brauchst du bei I die Grundform des Verbs im Simple Present. Überarbeite die Verbform.'],
        ['musik','Rechtschreibung: Hier steckt ein Schreibfehler. Kontrolliere die englische Schreibweise.'],
        ['i','Großschreibung: Das englische Pronomen für ich wird immer großgeschrieben. Passe die Großschreibung an.'],
        ['make','Wortwahl: Hier ist eine feste englische Wortverbindung nötig. Überprüfe das Verb für Aufgaben erledigen.'],
        ['homeworks','Mehrzahl: Das englische Wort für Hausaufgaben ist nicht zählbar und hat kein Plural-s. Überarbeite die Endung.']
      ] : [
        ['make','Wortwahl: Die englische Wortverbindung für Aufgaben erledigen braucht noch ein anderes Verb.'],
        ['homeworks','Mehrzahl: Hausaufgaben ist im Englischen nicht zählbar: Das Wort hat kein Plural-s. Überarbeite die Endung.']
      ];
      const issues=points.map(([quote,message])=>{
        const start=quote==='i'?answer.indexOf(' i ')+1:answer.indexOf(quote);
        return {quote,message,problem:{start,end:start+quote.length}};
      });
      Object.assign(run,{feedback:checks===1?'Die Häufigkeit hast du richtig übersetzt 👍':'👍 Verbform und Schreibweise sind jetzt richtig. Zwei Stellen brauchen noch Aufmerksamkeit.',status:'revise',checkedAnswer:answer,issues});
      run.history.push({id:`multi-${checks}`,answer,feedback:run.feedback,status:'revise',issues,help:null});
    }
    return route.fulfill({json:{run}});
  });
  await prepare(page,light);await page.locator('#launch-settings-start').click();
  await page.locator('#sentence-answer').fill('  '+initial);await page.locator('#sentence-submit').click();
  const points=page.locator('.sentence-stage__feedback-entry').last().locator('.sentence-stage__issues > li');
  const marks=page.locator('button.sentence-stage__problem');
  await expect(points).toHaveCount(5);
  await expect(page.locator('ol.sentence-stage__issues')).toHaveCount(0);
  expect(await points.first().evaluate(el=>getComputedStyle(el).listStyleType)).toBe('disc');
  await expect(points.locator('strong i')).toHaveText(['listening','musik','i','make','homeworks']);
  await expect(marks).toHaveText(['listening','musik','i','make','homeworks']);
  await expect(marks.first()).toHaveAttribute('aria-label', 'Problemstelle „listening“ bearbeiten');
  await expect(page.locator('#sentence-feedback-text')).not.toContainText('1.');
  await expect(points.last()).toContainText('nicht zählbar');
  for(const word of ['listening','musik','i','make','homeworks']) {
    await marks.filter({hasText:new RegExp('^'+word+'$')}).click();
    await expect(page.locator('#sentence-answer')).toBeFocused();
    expect(await page.locator('#sentence-answer').evaluate(el=>el.value.slice(el.selectionStart,el.selectionEnd))).toBe(word);
  }
  await page.screenshot({path:testInfo.outputPath(`structured-feedback-${light?'light':'dark'}.png`),animations:'disabled',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('structured-feedback-mobile.png'),animations:'disabled',fullPage:true});
  await page.locator('#sentence-answer').fill('I often listen to music when I make homeworks.');
  await expect(page.locator('span.sentence-stage__problem')).toHaveCount(5);
  await expect(marks).toHaveCount(0);
  await page.locator('#sentence-submit').click();
  await expect(marks).toHaveText(['make','homeworks']);
  await expect(points).toHaveCount(2);
  await expect(page.locator('.sentence-stage__feedback-entry')).toHaveCount(2);
  await expect(page.locator('#sentence-feedback-text')).not.toContainText('Grundform');
  expect(errors).toEqual([]);
});
