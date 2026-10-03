const test = require("node:test");
const assert = require("node:assert/strict");
const { SentenceService, locateProblem } = require("../lib/sentence-service");
const document = { set: { title: "Context", languages: { source: "de", target: "en" } }, cards: [{ source: { text: "vorübergehend" }, target: { text: "temporarily" }, acceptedAnswers: ["for a while"] }] };
const prompt = { prefix: "Der Zoo ist ", focus: "vorübergehend", suffix: " geschlossen." };
const accepted = { grammar: true, meaning: true, target: true, spelling: true, hint: "Gut.", help: null, issues: [] };
function service(results) {
  const calls = [];
  return { calls, service: new SentenceService({ client: { responses: { create: async body => {
    calls.push(body);
    let value = results.shift();
    if (body.text.format.name === "sentence_prompt" && value?.focus && !value.focus.includes("<")) value = { ...value, focus: JSON.parse(body.input[0].content).source_expression };
    if (value instanceof Error) throw value;
    return { status: "completed", output_text: JSON.stringify(value) };
  } } } }) };
}
test("context prompt hides target and unrelated actor cannot resume/check a run", async () => {
  const { service: s, calls } = service([prompt, accepted]);
  const run = await s.start("tablet:a", "sets/a.json", document, "source-target", 1);
  assert.equal(JSON.stringify(run).includes("temporarily"), false);
  assert.equal(run.prompt.focus, "vorübergehend");
  assert.throws(() => s.get("tablet:b", run.id, "sets/a.json"), /abgelaufen/);
  assert.throws(() => s.get("tablet:a", run.id, "sets/b.json"), /abgelaufen/);
  await assert.rejects(s.next("tablet:a", run.id, "sets/a.json", run.prompt.id), /Prüfe/);
  const result = await s.check("tablet:a", run.id, "sets/a.json", run.prompt.id, "The zoo is temporarily closed.");
  assert.equal(result.accepted, true);
  assert.deepEqual(JSON.parse(calls[1].input[0].content).accepted_variants, ["for a while"]);
  assert.equal(calls[0].model, "gpt-6-luna");
  assert.equal(calls[0].reasoning.effort, "none");
  assert.equal(calls[1].reasoning.effort, "low", "revision assessment gets a small consistency check; generation stays immediate");
  assert.equal(calls[1].model, calls[0].model);
  assert.equal(calls[0].store, false);
  await s.check("tablet:a", run.id, "sets/a.json", run.prompt.id, "The zoo is temporarily closed.");
  assert.equal(calls.length, 2);
  assert.equal((await s.next("tablet:a", run.id, "sets/a.json", run.prompt.id)).complete, true);
});
test("brief feedback permits revision, uncertainty never accepts, provider error preserves retry", async () => {
  const { service: s, calls } = service([prompt, { ...accepted, grammar: false, hint: "Die Vokabel passt. Achte auf die Form von be.", issues: [{quote:null,occurrence:0,message:"Das Subjekt ist Einzahl. Passe die Verbform dazu an."}] }, { ...accepted, meaning: null }, new Error("provider-secret"), accepted]);
  const run = await s.start("a", "sets/a.json", document, "source-target", 1);
  const check = answer => s.check("a", run.id, "sets/a.json", run.prompt.id, answer);
  assert.equal((await check("The zoo are temporarily closed.")).accepted, false);
  await check("The zoo are temporarily closed.");
  assert.equal(calls.length, 2, "identical check does not cost another call");
  assert.equal((await check("Something ambiguous")).accepted, false);
  await assert.rejects(check("The zoo is temporarily closed."), error => error.status === 503 && !error.message.includes("secret"));
  assert.equal((await check("The zoo is temporarily closed.")).accepted, true);
});
test("next is retryable and idempotent; chosen cards have no repeats", async () => {
  const { service: s, calls } = service([prompt, accepted, new Error("timeout"), { prefix: "Die ", focus: "Fähre", suffix: " kommt." }, accepted]);
  const doc = { ...document, cards: [...document.cards, { source: { text: "Fähre" }, target: { text: "ferry" } }] };
  const run = await s.start("a", "sets/a.json", doc, "source-target", 2);
  await s.check("a", run.id, "sets/a.json", run.prompt.id, "Correct sentence");
  await assert.rejects(s.next("a", run.id, "sets/a.json", run.prompt.id));
  assert.equal(s.get("a", run.id, "sets/a.json").index, 0);
  const second = await s.next("a", run.id, "sets/a.json", run.prompt.id);
  assert.equal(second.position, 2);
  assert.equal((await s.next("a", run.id, "sets/a.json", run.prompt.id)).prompt.id, second.prompt.id);
  assert.equal(calls.length, 4);
  assert.equal(new Set(s.get("a", run.id, "sets/a.json").cards.map(x => x.source.text)).size, 2);
  await assert.rejects(s.check("a", run.id, "sets/a.json", run.prompt.id, "old"), /aktuell/);
});
test("generic sets, invalid counts, oversized answers and malformed provider responses fail closed", async () => {
  const { service: s, calls } = service([{ ...prompt, focus: "<b>bad</b>" }, prompt, { ...accepted, target: "true" }]);
  await assert.rejects(s.start("a", "sets/a.json", { ...document, set: { languages: { source: "und", target: "und" } } }, "source-target", 1));
  await assert.rejects(s.start("b", "sets/a.json", document, "source-target", 21));
  assert.equal(calls.length, 0);
  await assert.rejects(s.start("c", "sets/a.json", document, "source-target", 1));
  const run = await s.start("d", "sets/a.json", document, "source-target", 1);
  await assert.rejects(s.check("d", run.id, "sets/a.json", run.prompt.id, "x".repeat(601)));
  await assert.rejects(s.check("d", run.id, "sets/a.json", run.prompt.id, "valid input"), error => error.status === 503);
  assert.equal(s.get("d", run.id, "sets/a.json").accepted, false);
});
test("reverse direction and API outage never leak answers or fabricate acceptance", async () => {
  const { service: s, calls } = service([{ prefix: "The zoo is ", focus: "temporarily", suffix: " closed." }]);
  const run = await s.start("a", "sets/a.json", document, "target-source", 1);
  assert.equal(run.targetLanguage, "de");
  const input = JSON.parse(calls[0].input[0].content);
  assert.equal(input.source_expression, "temporarily");
  assert.equal(input.target_vocabulary, "vorübergehend");
  assert.equal(JSON.stringify(run).includes("vorübergehend"), false);
  await assert.rejects(new SentenceService({ apiKey: "" }).start("a", "sets/a.json", document, "source-target", 1), error => error.status === 503);
});
test("source focus is fixed by schema and wrong-language focus is rejected", async () => {
  const calls = [];
  const s = new SentenceService({ client: { responses: { create: async body => {
    calls.push(body);
    return { status: "completed", output_text: JSON.stringify({ prefix: "The zoo is ", focus: "temporarily", suffix: " closed." }) };
  } } } });
  await assert.rejects(s.start("a", "sets/a.json", document, "source-target", 1), error => error.status === 503);
  assert.deepEqual(calls[0].text.format.schema.properties.focus.enum, ["vorübergehend"]);
  assert.equal(s.runs.size, 0);
});
test("parallel requests are bounded per identity and expired runs cannot be used", async () => {
  let clock = 0;
  let resolve;
  const s = new SentenceService({ now: () => clock, client: { responses: { create: () => new Promise(done => { resolve = done; }) } } });
  const first = s.start("a", "sets/a.json", document, "source-target", 1);
  await assert.rejects(s.start("a", "sets/a.json", document, "source-target", 1), error => error.status === 429);
  resolve({ status: "completed", output_text: JSON.stringify(prompt) });
  const run = await first;
  clock = 12 * 60 * 60 * 1000 + 1;
  assert.throws(() => s.get("a", run.id, "sets/a.json"), error => error.status === 410);
  assert.equal(s.runs.size, 0);
});

test("problem quotes locate exact whole words and reject broad or invented markings", () => {
  const answer = "Breakfast ist included. ist";
  assert.deepEqual(locateProblem(answer, { quote: "ist", occurrence: 0 }), { start: 10, end: 13 });
  assert.deepEqual(locateProblem(answer, { quote: "ist", occurrence: 1 }), { start: 24, end: 27 });
  assert.deepEqual(locateProblem("🍳 Breakfast ist included.", { quote: "ist", occurrence: 0 }), { start: 13, end: 16 });
  const singleLetter = "I often listening to musik when i make homeworks.";
  assert.deepEqual(locateProblem(singleLetter, {quote:"i",occurrence:0}), {start:32,end:33}, 'occurrence counts whole words, not letters inside listening or musik');
  for (const problem of [null, { quote: "is", occurrence: 0 }, { quote: answer, occurrence: 0 }, { quote: "Breakfast ist included.", occurrence: 0 }, { quote: ".", occurrence: 0 }, { quote: "missing", occurrence: 0 }, { quote: "ist", occurrence: -1 }, { quote: "ist", occurrence: 2 }]) {
    assert.equal(locateProblem(answer, problem), null);
  }
});
test("localized feedback is tied to the checked attempt, never accepted or uncertain answers", async () => {
  const { service: s } = service([prompt,
    { ...accepted, grammar: false, hint: "Die Vokabel passt. ‚ist‘ ist noch Deutsch; überprüfe die englische Verbform.", issues: [{ quote: "ist", occurrence: 0, message: "Dieser Teil ist noch Deutsch. Für einen englischen Satz brauchst du die passende englische Verbform." }] },
    { ...accepted, grammar: null },
    accepted,
  ]);
  const run = await s.start("a", "sets/a.json", document, "source-target", 1);
  const check = answer => s.check("a", run.id, "sets/a.json", run.prompt.id, answer);
  const revise = await check("  The zoo ist temporarily closed.  ");
  assert.deepEqual(revise.issues[0].problem, { start: 8, end: 11 });
  assert.equal(revise.checkedAnswer, "The zoo ist temporarily closed.");
  assert.deepEqual(s.view(s.get("a", run.id, "sets/a.json")).issues[0].problem, revise.issues[0].problem);
  assert.deepEqual((await check("The zoo ist closed temporarily.")).issues, []);
  const correct = await check("The zoo is temporarily closed.");
  assert.deepEqual(correct.issues, []);
  assert.deepEqual(correct.history[0].issues[0].problem, revise.issues[0].problem);
  assert.equal(correct.history[0].answer, revise.checkedAnswer);
  assert.equal(correct.history.length, 3);
  assert.deepEqual((await s.next("a", run.id, "sets/a.json", run.prompt.id)).issues, []);
});

test("difficulty controls generation and survives resume; invalid difficulty never calls the provider", async () => {
  const { service: s, calls } = service([prompt]);
  await assert.rejects(s.start("a", "sets/a.json", document, "source-target", 1, "hardcore"), error => error.status === 400);
  assert.equal(calls.length, 0);
  const run = await s.start("a", "sets/a.json", document, "source-target", 1, "hard");
  assert.equal(run.difficulty, "hard");
  assert.equal(s.view(s.get("a", run.id, "sets/a.json")).difficulty, "hard");
  assert.equal(JSON.parse(calls[0].input[0].content).difficulty, "hard");
});
test("recognizable typos block acceptance independently; corrections clear optional help", async () => {
  const { service: s } = service([prompt, { ...accepted, spelling: false, hint: "Fast geschafft: Prüfe die Schreibweise von „temprarily“.", issues: [{ quote: "temprarily", occurrence: 0, message: "Hier steckt ein Schreibfehler. Kontrolliere die Schreibweise der Zielvokabel noch einmal." }] }, accepted]);
  const run = await s.start("a", "sets/a.json", document, "source-target", 1);
  const revise = await s.check("a", run.id, "sets/a.json", run.prompt.id, "The zoo is temprarily closed.");
  assert.equal(revise.accepted, false);
  assert.equal(revise.status, "revise");
  assert.deepEqual(revise.issues[0].problem, { start: 11, end: 21 });
  await assert.rejects(s.next("a", run.id, "sets/a.json", run.prompt.id));
  assert.equal((await s.check("a", run.id, "sets/a.json", run.prompt.id, "The zoo is temporarily closed.")).help, null);
});
test("unsafe transfer examples and invented translated quotes get one bounded repair", async () => {
  const unsafe = { ...accepted, grammar: false, hint: "Prüfe die Verbform.", issues: [{quote:null,occurrence:0,message:"Das Subjekt steht in der Einzahl. Passe die Verbform an."}], help: { explanation: "Das Subjekt steht in der Einzahl.", example: "The shop is temporarily closed." } };
  const safe = { ...unsafe, help: null };
  const { service: s, calls } = service([prompt, unsafe, safe]);
  const run = await s.start("a", "sets/a.json", document, "source-target", 1);
  const result = await s.check("a", run.id, "sets/a.json", run.prompt.id, "The zoo are temporarily closed.");
  assert.equal(result.help, null);
  assert.equal(calls.length, 3);
  const invented = { ...accepted, meaning: false, hint: "Ergänze „tomorrow“.", issues: [{quote:null,occurrence:0,message:"Die Zeitangabe fehlt."}], help: null };
  const rejected = service([prompt, invented, invented]).service;
  const second = await rejected.start("b", "sets/a.json", document, "source-target", 1);
  await assert.rejects(rejected.check("b", second.id, "sets/a.json", second.prompt.id, "The zoo is temporarily closed."), error => error.status === 503);
  assert.equal(rejected.get("b", second.id, "sets/a.json").lastAnswer, undefined);
  assert.equal(rejected.get("b", second.id, "sets/a.json").accepted, false);
});
test("malformed optional help never partially accepts or caches a response", async () => {
  const { service: s } = service([prompt, { ...accepted, help: { explanation: "", example: "" } }]);
  const run = await s.start("a", "sets/a.json", document, "source-target", 1);
  await assert.rejects(s.check("a", run.id, "sets/a.json", run.prompt.id, "The zoo is temporarily closed."));
  assert.equal(s.get("a", run.id, "sets/a.json").accepted, false);
  assert.equal(s.get("a", run.id, "sets/a.json").lastAnswer, undefined);
});

test("spelling feedback does not invent letter counts and repairs once", async () => {
  const unsafe = { ...accepted, spelling: false, hint: "Da fehlt ein Buchstabe.", issues: [{quote:"temprarily",occurrence:0,message:"Prüfe die Schreibweise."}] };
  const safe = { ...unsafe, hint: "Fast da! Prüfe die Schreibweise von temprarily.", help: null };
  const { service: s, calls } = service([prompt, unsafe, safe]);
  const run = await s.start("a", "sets/a.json", document, "source-target", 1);
  const result = await s.check("a", run.id, "sets/a.json", run.prompt.id, "The zoo is temprarily closed.");
  assert.equal(result.accepted, false);
  assert.equal(result.feedback, "🔎 " + safe.hint);
  assert.equal(calls.length, 3);
});

test("general letter checks are useful spelling guidance, while counts and positions still require repair", async () => {
  const revise = message => ({ ...accepted, spelling: false, hint: "Die Aussage passt 👍", issues: [{quote:"temprarily",occurrence:0,message}] });
  for (const message of ["Prüfe die Buchstaben dieses Wortes sorgfältig.", "Prüfe die Buchstabenfolge und überarbeite das Wort."]) {
    const { service: s, calls } = service([prompt, revise(message)]);
    const run = await s.start("a", "sets/a.json", document, "source-target", 1);
    const result = await s.check("a", run.id, "sets/a.json", run.prompt.id, "The zoo is temprarily closed.");
    assert.equal(calls.length, 2);
    assert.equal(result.accepted, false);
    assert.equal(result.issues[0].message, message);
  }
  for (const message of ["Das Wort braucht 11 Buchstaben.", "Prüfe die letzten Buchstaben an dieser Stelle.", "Die Buchstabenanzahl stimmt nicht."]) {
    const { service: s, calls } = service([prompt, revise(message), revise("Prüfe die Schreibweise sorgfältig.")]);
    const run = await s.start("a", "sets/a.json", document, "source-target", 1);
    const result = await s.check("a", run.id, "sets/a.json", run.prompt.id, "The zoo is temprarily closed.");
    assert.equal(calls.length, 3);
    assert.equal(result.history.length, 1);
    assert.equal(result.accepted, false);
  }
});

test("revision history retains quotes, exposes no grading flags and resets for the next sentence", async () => {
  const revise = { ...accepted, grammar: false, hint: "Prüfe die Verbform. 🔎", issues: [{quote:null,occurrence:0,message:"Das Subjekt ist Einzahl. Passe die Verbform dazu an."}] };
  const { service: s, calls } = service([prompt, revise, revise, revise, revise, new Error("outage"), accepted, prompt, revise]);
  const doc = { ...document, cards: [...document.cards, { source: { text: "Fähre" }, target: { text: "ferry" } }] };
  const run = await s.start("a", "sets/a.json", doc, "source-target", 2);
  for (const word of ["one", "two", "three", "four"]) await s.check("a", run.id, "sets/a.json", run.prompt.id, "The zoo " + word + " temporarily closed.");
  const internal = s.get("a", run.id, "sets/a.json");
  assert.equal(internal.attempts.length, 4);
  assert.equal(internal.attempts[0].answer, "The zoo one temporarily closed.");
  const history = s.view(internal).history;
  assert.equal(history.length, 4);
  assert.deepEqual(Object.keys(history[0]).sort(), ['answer', 'feedback', 'help', 'id', 'issues', 'status']);
  assert.equal(history[0].answer, 'The zoo one temporarily closed.');
  assert.equal(history[0].feedback, revise.hint);
  assert.equal(s.view(internal).attempts, undefined);
  await s.check('a', run.id, 'sets/a.json', run.prompt.id, 'The zoo four temporarily closed.');
  assert.deepEqual(s.view(internal).history, history, 'cached identical check does not append');
  await assert.rejects(s.check("a", run.id, "sets/a.json", run.prompt.id, "The zoo is temporarily closed."));
  assert.equal(internal.attempts.length, 4);
  const result = await s.check("a", run.id, "sets/a.json", run.prompt.id, "The zoo is temporarily closed.");
  const submitted = JSON.parse(calls[6].input[0].content);
  assert.equal(submitted.previous_attempts.length, 4);
  assert.equal(submitted.previous_attempts[2].feedback, revise.hint);
  assert.equal(result.history.length, 5);
  assert.deepEqual(result.history.slice(0, 4), history);
  assert.match(result.feedback, /\p{Extended_Pictographic}/u);
  const next = await s.next("a", run.id, "sets/a.json", run.prompt.id);
  assert.deepEqual(internal.attempts, []);
  assert.deepEqual(next.history, []);
  await s.check("a", next.id, "sets/a.json", next.prompt.id, "Next attempt");
  assert.deepEqual(JSON.parse(calls.at(-1).input[0].content).previous_attempts, []);
});

test("revision hints repair task-word choices without blocking grammar-category questions", async () => {
  const unsafe = { ...accepted, grammar: false, hint: "Muss es need oder needs heißen? 🔎", issues: [{quote:null,occurrence:0,message:"Das Subjekt ist Einzahl. Passe die Verbform an."}] };
  const safe = { ...unsafe, hint: "Die Häufigkeit ist jetzt enthalten 👍 Prüfe die Verbform: Bezieht sie sich auf Einzahl oder Mehrzahl?" };
  const { service: s, calls } = service([prompt, unsafe, safe]);
  const run = await s.start("a", "sets/a.json", document, "source-target", 1);
  const result = await s.check("a", run.id, "sets/a.json", run.prompt.id, "The zoo need repair temporarily.");
  assert.equal(result.feedback, safe.hint);
  assert.equal(calls.length, 3);
});

test("history limit preserves every validated attempt and still allows cached checks", async () => {
  const revise = { ...accepted, grammar: false, hint: 'Prüfe die Verbform. 🔎', issues: [{quote:null,occurrence:0,message:'Das Subjekt ist Einzahl. Passe die Verbform dazu an.'}] };
  const { service: s, calls } = service([prompt, ...Array(40).fill(revise)]);
  const run = await s.start('a', 'sets/a.json', document, 'source-target', 1);
  for (let i = 0; i < 40; i++) await s.check('a', run.id, 'sets/a.json', run.prompt.id, `The zoo ${i} temporarily closed.`);
  const result = await s.check('a', run.id, 'sets/a.json', run.prompt.id, 'The zoo 39 temporarily closed.');
  assert.equal(result.history.length, 40);
  assert.equal(result.history[0].answer, 'The zoo 0 temporarily closed.');
  await assert.rejects(s.check('a', run.id, 'sets/a.json', run.prompt.id, 'Another attempt'), error => error.status === 409);
  assert.equal(calls.length, 41);
  assert.equal(s.view(s.get('a', run.id, 'sets/a.json')).history.length, 40);
});

test("several issues bind individual rules to exact spans and remain in revision context", async () => {
  const answer = 'I often listening to musik when i make homeworks.';
  const issues = [
    {quote:'listening',occurrence:0,message:'Often beschreibt eine Gewohnheit. Hier brauchst du bei I die Grundform des Verbs im Simple Present; überarbeite die Verbform.'},
    {quote:'musik',occurrence:0,message:'Hier steckt ein Schreibfehler. Kontrolliere die englische Schreibweise.'},
    {quote:'make',occurrence:0,message:'Hier ist eine feste englische Wortverbindung nötig. Überprüfe das Verb für Aufgaben erledigen.'},
    {quote:'homeworks',occurrence:0,message:'Das englische Wort für Hausaufgaben ist nicht zählbar und hat kein Plural-s. Überarbeite die Endung.'},
  ];
  const revise = {...accepted, grammar:false, spelling:false, hint:'Die Häufigkeit hast du erkannt 👍', issues};
  const {service:s,calls} = service([prompt,revise,accepted]);
  const doc = {set:{title:'Context',languages:{source:'de',target:'en'}},cards:[{source:{text:'Musik'},target:{text:'music'}}]};
  const run = await s.start('a','sets/a.json',doc,'source-target',1);
  const result = await s.check('a',run.id,'sets/a.json',run.prompt.id,answer);
  assert.deepEqual(result.issues.map(issue => answer.slice(issue.problem.start,issue.problem.end)), ['listening','musik','make','homeworks']);
  assert.deepEqual(result.history[0].issues,result.issues);
  await s.check('a',run.id,'sets/a.json',run.prompt.id,'I often listen to music when I do homework.');
  assert.deepEqual(JSON.parse(calls[2].input[0].content).previous_attempts[0].issues,issues.map(({quote,message})=>({quote,message})));
});

test("invalid or overlapping issue quotes repair once; unrepaired feedback is never retained", async () => {
  const bad = {...accepted,grammar:false,hint:'Noch nicht ganz 🔎',issues:[{quote:'ist',occurrence:0,message:'Hier ist noch ein deutsches Verb.'},{quote:'ist',occurrence:0,message:'Prüfe dieses Verb.'}]};
  const safe = {...bad,issues:[bad.issues[0]]};
  const {service:s,calls} = service([prompt,bad,safe]);
  const run=await s.start('a','sets/a.json',document,'source-target',1);
  const result=await s.check('a',run.id,'sets/a.json',run.prompt.id,'The zoo ist temporarily closed.');
  assert.equal(calls.length,3);
  assert.equal(result.issues.length,1);
  assert.equal(result.history.length,1);
  const invalid={...bad,issues:[{quote:'invented',occurrence:0,message:'Prüfe die Verbform.'}]};
  const failed=service([prompt,invalid,invalid]).service;
  const other=await failed.start('b','sets/a.json',document,'source-target',1);
  await assert.rejects(failed.check('b',other.id,'sets/a.json',other.prompt.id,'The zoo ist temporarily closed.'),e=>e.status===503);
  assert.deepEqual(failed.view(failed.get('b',other.id,'sets/a.json')).history,[]);
});

test("issue messages get the same no-solution safeguards; grammar rules themselves are permitted", async () => {
  const bad={...accepted,spelling:false,hint:'Fast geschafft 🔎',issues:[{quote:'temprarily',occurrence:0,message:'Schreibe temporarily.'}]};
  const safe={...bad,issues:[{quote:'temprarily',occurrence:0,message:'Hier steckt ein Schreibfehler. Kontrolliere die englische Schreibweise.'}]};
  const {service:s,calls}=service([prompt,bad,safe]);
  const run=await s.start('a','sets/a.json',document,'source-target',1);
  const result=await s.check('a',run.id,'sets/a.json',run.prompt.id,'The zoo is temprarily closed.');
  assert.equal(calls.length,3);
  assert.equal(result.issues[0].message,safe.issues[0].message);
  assert.equal(result.accepted,false);
});

test("missing content has a named rule but no invented marking; empty revision issues repair", async () => {
  const bad={...accepted,meaning:false,hint:'Ein Detail fehlt 🔎',issues:[]};
  const safe={...bad,issues:[{quote:null,occurrence:0,message:'Die Häufigkeit aus der Vorlage fehlt. Ergänze auch diese Information.'}]};
  const {service:s,calls}=service([prompt,bad,safe]);
  const run=await s.start('a','sets/a.json',document,'source-target',1);
  const result=await s.check('a',run.id,'sets/a.json',run.prompt.id,'The zoo is temporarily closed.');
  assert.equal(calls.length,3);
  assert.equal(result.issues[0].problem,null);
});

test("acceptance cannot coexist with explicit correction points", async () => {
  const contradictory={...accepted,hint:'Das passt 👍',issues:[{quote:'ist',occurrence:0,message:'Dieser Teil ist noch Deutsch. Du brauchst die englische Verbform.'}]};
  const safe={...contradictory,grammar:false,hint:'Die Zielvokabel passt 👍'};
  const {service:s,calls}=service([prompt,contradictory,safe]);
  const run=await s.start('a','sets/a.json',document,'source-target',1);
  const result=await s.check('a',run.id,'sets/a.json',run.prompt.id,'The zoo ist temporarily closed.');
  assert.equal(calls.length,3);
  assert.equal(result.accepted,false);
  assert.equal(result.history.length,1);
  assert.equal(result.history[0].status,'revise');
});
