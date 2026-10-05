const test = require("node:test");
const assert = require("node:assert/strict");
const { SentenceService, locateProblem } = require("../lib/sentence-service");
const document = { set: { title: "Context", languages: { source: "de", target: "en" } }, cards: [{ source: { text: "vorübergehend" }, target: { text: "temporarily" }, acceptedAnswers: ["for a while"] }] };
const prompt = { complete: true, prefix: "Der Zoo ist ", focus: "vorübergehend", suffix: " geschlossen." };
const accepted = { grammar: true, meaning: true, target: true, spelling: true, hint: "Gut.", help: null, issues: [] };
const summaryResult = (attemptId) => ({ praise: "Du hast die Aussage passend übersetzt und den Tippfehler verbessert 👍", points: [{ title: "Rechtschreibung", tip: "Prüfe die Schreibweise sorgfältig.", examples: [{ attemptId, wrong: "temprarily", right: "temporarily" }] }] });
function service(results) {
  const calls = [], reviewCalls = [];
  return { calls, reviewCalls, service: new SentenceService({ client: { responses: { create: async body => {
    if (body.text.format.name === "sentence_prompt_review") {
      reviewCalls.push(body);
      return { status: "completed", output_text: JSON.stringify({ grammar: true, natural: true, vocabulary: true, level: true, reason: "" }) };
    }
    // These existing assertions track generation/learner feedback; review calls
    // are tracked separately and exercised below without consuming fixtures.
    calls.push(body);
    let value = results.shift();
    if (body.text.format.name === "sentence_prompt" && value?.focus && !value.focus.includes("<")) value = { complete: true, ...value, focus: JSON.parse(body.input[0].content).source_expression };
    if (value instanceof Error) throw value;
    return { status: "completed", output_text: JSON.stringify(value) };
  } } } }) };
}
test("sentence starters omit only placeholder ellipses and reject incomplete/repeated generation before display", async () => {
  const doc = { ...document, cards: [{ source: { text: "Ein Nachteil ist …" }, target: { text: "One disadvantage is" } }] };
  const good = { complete: true, prefix: "", focus: "Ein Nachteil ist", suffix: " der hohe Preis." };
  for (const bad of [
    { ...good, prefix: "Ein Nachteil ist ", suffix: "" },
    { ...good, suffix: "" },
    { ...good, suffix: " …" },
    { ...good, complete: false },
  ]) {
    const { service: s, calls } = service([bad, good]);
    const run = await s.start("a", "sets/a.json", doc, "source-target", 1);
    assert.equal(run.prompt.prefix + run.prompt.focus + run.prompt.suffix, "Ein Nachteil ist der hohe Preis.");
    assert.equal(run.prompt.focus, "Ein Nachteil ist");
    assert.equal(doc.cards[0].source.text, "Ein Nachteil ist …", "set vocabulary remains unchanged");
    assert.equal(calls.length, 2);
    assert.match(calls[1].instructions, /REPAIR:/);
  }
  const { service: s } = service([{ ...good, suffix: "" }, { ...good, suffix: "" }]);
  await assert.rejects(s.start("a", "sets/a.json", doc, "source-target", 1), error => error.status === 503);
  assert.equal(s.runs.size, 0, "do not offer a broken fallback task");
});

test("separate source quality review repairs unsuitable tasks once before exposure or coverage", async () => {
  const approved = { grammar: true, natural: true, vocabulary: true, level: true, reason: "" };
  for (const field of ["grammar", "natural", "vocabulary", "level"]) {
    const calls = [], reviews = [{ ...approved, [field]: false, reason: "The proposed context is unsuitable." }, approved];
    const s = new SentenceService({ client: { responses: { create: async body => {
      calls.push(body);
      return { status: "completed", output_text: JSON.stringify(body.text.format.name === "sentence_prompt_review" ? reviews.shift() : prompt) };
    } } } });
    let commits = 0; const commit = s.orderStore.commit.bind(s.orderStore);
    s.orderStore.commit = async prepared => { commits++; return commit(prepared); };
    const run = await s.start("a", "sets/a.json", document, "source-target", 1);
    assert.deepEqual(calls.map(call => call.text.format.name), ["sentence_prompt", "sentence_prompt_review", "sentence_prompt", "sentence_prompt_review"]);
    assert.equal(JSON.parse(calls[1].input[0].content).source_sentence, "Der Zoo ist vorübergehend geschlossen.");
    assert.equal(JSON.parse(calls[2].input[0].content).repair_reason.includes("unsuitable"), true);
    assert.equal(commits, 0, "rejected preparation never consumes vocabulary");
    assert.equal(s.logStore.memory.get(run.id).tasks.length, 1, "only the reviewed task enters the exercise log");
    await s.shown("a", run.id, "sets/a.json", run.prompt.id);
    assert.equal(commits, 1);
  }
});

test("failed or malformed source review never exposes a fallback and preserves a running context", async () => {
  const approved = { grammar: true, natural: true, vocabulary: true, level: true, reason: "" };
  for (const rejected of [{ ...approved, grammar: false, reason: "Missing complement." }, { ...approved, grammar: "true" }, new Error("provider-secret")]) {
    const calls = []; let rejectReview = false;
    const s = new SentenceService({ client: { responses: { create: async body => {
      calls.push(body);
      const value = body.text.format.name === "sentence_prompt_review" ? rejectReview ? rejected : approved : rejectReview ? { ...prompt, prefix: "Die Schule ist " } : prompt;
      if (value instanceof Error) throw value;
      return { status: "completed", output_text: JSON.stringify(value) };
    } } } });
    const run = await s.start("a", "sets/a.json", document, "source-target", 1);
    rejectReview = true;
    await assert.rejects(s.replace("a", run.id, "sets/a.json", run.prompt.id), error => error.status === 503 && !error.message.includes("provider-secret"));
    assert.equal(s.get("a", run.id, "sets/a.json").prompt.id, run.prompt.id);
    assert.equal(s.logStore.memory.get(run.id).tasks.length, 1);
    assert.ok(calls.length <= 6, "at most two generation/review pairs, with no endless retry");
  }
});

test("lowercase fixed vocabulary requires a capitalised frame without changing the set expression", async () => {
  const doc = { ...document, set: { ...document.set, languages: { source: "en", target: "de" } }, cards: [{ source: { text: "wicker" }, target: { text: "geflochtenes Material" } }] };
  const { service: s, calls, reviewCalls } = service([
    { prefix: "", focus: "wicker", suffix: " is strong." },
    { prefix: "We use ", focus: "wicker", suffix: " for baskets." },
  ]);
  const run = await s.start("a", "sets/a.json", doc, "source-target", 1);
  assert.equal(run.prompt.focus, "wicker");
  assert.equal(run.prompt.prefix, "We use ");
  assert.equal(JSON.parse(calls[1].input[0].content).repair_reason.includes("capital"), true);
  assert.equal(reviewCalls.length, 1, "structurally broken candidates do not cost a quality review");
});

test("new sentence retains vocabulary, count and order while logging the abandoned feedback loop", async () => {
  const revision = { ...accepted, grammar: false, hint: "Passe die Verbform an 👍", issues: [{ quote: "are", occurrence: 0, message: "Verbform: Das Subjekt ist Einzahl." }] };
  const different = { ...prompt, prefix: "Die Schule ist " };
  const { service: s, calls } = service([prompt, revision, prompt, different, accepted]);
  let commits = 0; const commit = s.orderStore.commit.bind(s.orderStore);
  s.orderStore.commit = async prepared => { commits++; return commit(prepared); };
  const run = await s.start("tablet:a", "sets/a.json", document, "source-target", 1);
  await s.check("tablet:a", run.id, "sets/a.json", run.prompt.id, "The zoo are temporarily closed.");
  const replacement = await s.replace("tablet:a", run.id, "sets/a.json", run.prompt.id);
  assert.equal(replacement.position, 1); assert.equal(replacement.total, 1); assert.equal(replacement.complete, false);
  assert.equal(replacement.accepted, false); assert.equal(replacement.shown, false);
  assert.deepEqual(replacement.history, []); assert.equal(replacement.feedback, "");
  assert.equal(replacement.prompt.focus, run.prompt.focus); assert.notEqual(replacement.prompt.id, run.prompt.id);
  assert.equal(s.get("tablet:a", run.id, "sets/a.json").cards.length, 1);
  assert.equal((await s.replace("tablet:a", run.id, "sets/a.json", run.prompt.id)).prompt.id, replacement.prompt.id);
  assert.equal(calls.length, 4, "an old retry does not regenerate or duplicate the task");
  await assert.rejects(s.check("tablet:a", run.id, "sets/a.json", run.prompt.id, "Old answer"), /aktuell/);
  await assert.rejects(s.next("tablet:a", run.id, "sets/a.json", replacement.prompt.id), /Prüfe/);
  await s.shown("tablet:a", run.id, "sets/a.json", replacement.prompt.id);
  assert.equal(commits, 1, "replacement display does not consume another vocabulary");
  const record = s.logStore.memory.get(run.id);
  assert.equal(record.tasks.length, 2);
  assert.equal(record.tasks[0].attempts[0].answer, "The zoo are temporarily closed.");
  assert.equal(record.tasks[0].replacedByPromptId, replacement.prompt.id);
  assert.equal(record.tasks[0].acceptedAt, null); assert.equal(record.tasks[0].advancedAt, null);
  assert.equal(record.tasks[1].replacesPromptId, run.prompt.id);
  assert.equal(record.tasks[1].position, 1); assert.ok(record.tasks[1].shownAt);
  await s.check("tablet:a", run.id, "sets/a.json", replacement.prompt.id, "The school is temporarily closed.");
  assert.deepEqual(JSON.parse(calls.at(-1).input[0].content).previous_attempts, [], "old context must not assess a different sentence");
  assert.equal((await s.next("tablet:a", run.id, "sets/a.json", replacement.prompt.id)).complete, true);
});

test("replacement persistence retries reuse the prepared sentence and generation failure keeps the old task", async () => {
  const different = { ...prompt, prefix: "Die Schule ist " };
  const { service: s, calls } = service([prompt, new Error("provider-timeout"), different]);
  const run = await s.start("a", "sets/a.json", document, "source-target", 1);
  await assert.rejects(s.replace("a", run.id, "sets/a.json", run.prompt.id), error => error.status === 503);
  assert.equal(s.view(s.get("a", run.id, "sets/a.json")).prompt.id, run.prompt.id);
  const replace = s.logStore.replace.bind(s.logStore); let failures = 1;
  s.logStore.replace = async (...args) => { if (failures--) throw Error("disk"); return replace(...args); };
  await assert.rejects(s.replace("a", run.id, "sets/a.json", run.prompt.id), /gespeichert/);
  assert.equal(s.view(s.get("a", run.id, "sets/a.json")).prompt.id, run.prompt.id);
  const replacement = await s.replace("a", run.id, "sets/a.json", run.prompt.id);
  assert.equal(calls.length, 3); assert.notEqual(replacement.prompt.id, run.prompt.id);
  assert.equal(s.logStore.memory.get(run.id).tasks.length, 2);
});
test("context prompt hides target and unrelated actor cannot resume/check a run", async () => {
  const { service: s, calls, reviewCalls } = service([prompt, accepted]);
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
  assert.equal(calls[0].reasoning.effort, "medium");
  assert.equal(calls[0].max_output_tokens, 3000, "generation budget includes reasoning and structured output");
  assert.equal(s.logStore.memory.get(run.id).generation.reasoningEffort, "medium");
  assert.equal(s.logStore.memory.get(run.id).generation.maxOutputTokens, 3000);
  assert.equal(calls[1].reasoning.effort, "low", "revision assessment keeps its existing reasoning setting");
  assert.equal(calls[1].model, calls[0].model);
  assert.equal(calls[0].store, false);
  await s.check("tablet:a", run.id, "sets/a.json", run.prompt.id, "The zoo is temporarily closed.");
  assert.equal(calls.length, 2);
  assert.equal(reviewCalls.length, 1, "cached checks do not repeat source quality review");
  assert.equal(reviewCalls[0].reasoning.effort, "low");
  assert.equal(reviewCalls[0].max_output_tokens, 1200);
  assert.equal(s.logStore.memory.get(run.id).generation.reviewMaxOutputTokens, 1200);
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
    return { status: "completed", output_text: JSON.stringify({ complete: true, prefix: "The zoo is ", focus: "temporarily", suffix: " closed." }) };
  } } } });
  await assert.rejects(s.start("a", "sets/a.json", document, "source-target", 1), error => error.status === 503);
  assert.deepEqual(calls[0].text.format.schema.properties.focus.enum, ["vorübergehend"]);
  assert.equal(s.runs.size, 0);
});
test("parallel requests are bounded per identity and expired runs cannot be used", async () => {
  let clock = 0;
  let resolve;
  const s = new SentenceService({ now: () => clock, client: { responses: { create: body => body.text.format.name === "sentence_prompt_review" ? Promise.resolve({ status: "completed", output_text: JSON.stringify({ grammar: true, natural: true, vocabulary: true, level: true, reason: "" }) }) : new Promise(done => { resolve = done; }) } } });
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

test("language-reference formatting preserves solution protection and factual grammar guidance", async () => {
  for (const message of ["Schreibe `temporarily`.", "Wähle `need` oder `needs`."]) {
    const bad = { ...accepted, spelling: false, hint: "Fast geschafft 🔎", issues: [{ quote: "temprarily", occurrence: 0, message }] };
    const safe = { ...bad, issues: [{ ...bad.issues[0], message: "Rechtschreibung: Prüfe die Schreibweise von `temprarily`. Bei `I` steht die Grundform von `to have`." }] };
    const { service: s, calls } = service([prompt, bad, safe]);
    const run = await s.start("forms", "sets/forms.json", document, "source-target", 1);
    const result = await s.check("forms", run.id, "sets/forms.json", run.prompt.id, "I need the zoo to be temprarily closed.");
    assert.equal(calls.length, 3, "formatting must not hide a correction or candidate word pair");
    assert.equal(result.issues[0].message, safe.issues[0].message);
    assert.equal(result.accepted, false);
  }
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

test("few-shot coaching examples pass the same checks as real feedback without repair", async () => {
  const { buildSentenceFeedbackPrompt } = require("../lib/sentence-feedback-prompt");
  const examples = JSON.parse(buildSentenceFeedbackPrompt(40).split("# Beispiele (keine Textschablonen)\n")[1]);
  for (const { input, output } of examples) {
    const at = input.source_sentence.indexOf(input.focus);
    assert.ok(at >= 0, "example focus belongs to its source");
    const doc = { set: { title: "Coaching example", languages: { source: input.source_language, target: input.target_language } }, cards: [{ source: { text: input.focus }, target: { text: input.target_vocabulary }, acceptedAnswers: input.accepted_variants }] };
    const generated = { prefix: input.source_sentence.slice(0, at), focus: input.focus, suffix: input.source_sentence.slice(at + input.focus.length) };
    const { service: s, calls } = service([generated, output]);
    const run = await s.start("example", "sets/example.json", doc, "source-target", 1, "medium");
    const checked = await s.check("example", run.id, "sets/example.json", run.prompt.id, input.learner_answer);
    assert.equal(checked.accepted, [output.grammar, output.meaning, output.target, output.spelling].every(value => value === true));
    assert.equal(calls.length, 2, "illustrative feedback must satisfy schema, quote provenance and solution protection without repair");
    assert.ok(/\p{Extended_Pictographic}/u.test(checked.feedback));
    assert.equal(checked.issues.length, output.issues.length);
  }
});

test("provider quote choices contain real complete spans, including contractions, within schema limits", async () => {
  for (const answer of ["Wir kommen vor dem Mittagessen an.", "I'm today sick.\nI’m also tired.", Array.from({ length: 290 }, (_, index) => String.fromCodePoint(0x4e00 + index)).join(" ")]) {
    const { service: s, calls } = service([prompt, accepted]);
    const run = await s.start("quotes", "sets/quotes.json", document, "source-target", 1);
    await s.check("quotes", run.id, "sets/quotes.json", run.prompt.id, answer);
    const quotes = calls[1].text.format.schema.properties.issues.items.properties.quote.enum;
    assert.ok(quotes.includes(null), "missing content remains representable");
    assert.ok(quotes.length <= 1000);
    assert.ok(quotes.filter(Boolean).reduce((length, quote) => length + quote.length, 0) <= 15000);
    for (const quote of quotes.filter(Boolean)) assert.ok(locateProblem(answer.trim(), { quote, occurrence: 0 }));
    if (answer.startsWith("Wir")) {
      assert.ok(quotes.includes("vor"));
      assert.ok(!quotes.includes("vor dem Mittag"));
      assert.ok(!quotes.includes("vor dem Mittagess"));
    }
    if (answer.startsWith("I'm")) assert.ok(quotes.includes("I'm"));
  }
});

test("completion and requested summary use durable solved attempts, preserve device context and cache paid output", async () => {
  const revise = { ...accepted, spelling: false, hint: "Fast geschafft 🔎", issues: [{ quote: "temprarily", occurrence: 0, message: "Rechtschreibung: Prüfe dieses Wort." }] };
  const results = [prompt, revise, { ...prompt, prefix: "Der Park ist " }, new Error("private-provider-key"), revise, accepted];
  const { service: s, calls } = service(results);
  const actor = "tablet:blau-1", setPath = "sets/context.json";
  let run = await s.start(actor, setPath, document, "source-target", 1, "easy", { tabletId: "blau-1", ownerTeacherId: "julius" });
  await assert.rejects(s.summary(actor, run.id, setPath), error => error.status === 409);
  await s.check(actor, run.id, setPath, run.prompt.id, "The zoo is temprarily closed.");
  run = await s.replace(actor, run.id, setPath, run.prompt.id);
  await assert.rejects(s.check(actor, run.id, setPath, run.prompt.id, "MODEL_FAIL"));
  const revision = await s.check(actor, run.id, setPath, run.prompt.id, "The park is temprarily closed.");
  await s.check(actor, run.id, setPath, run.prompt.id, "The park is temporarily closed.");
  run = await s.next(actor, run.id, setPath, run.prompt.id);
  assert.equal(run.completion.sentences.length, 1);
  assert.equal(run.completion.sentences[0].attemptCount, 2);
  assert.equal(run.completion.sentences[0].answer, "The park is temporarily closed.");
  assert.equal(run.completion.summary, null);
  results.push(summaryResult(revision.history[0].id));
  const final = await s.summary(actor, run.id, setPath);
  const input = JSON.parse(calls.at(-1).input[0].content);
  assert.equal(input.sentences.length, 1); assert.equal(input.sentences[0].attemptCount, 2);
  assert.deepEqual(input.sentences[0].attempts.map(x => x.answer), ["The park is temprarily closed.", "The park is temporarily closed."]);
  assert.equal(calls.at(-1).text.format.name, "sentence_summary");
  assert.equal(calls.at(-1).reasoning.effort, "low");
  const raw = await s.logStore.read(s.get(actor, run.id, setPath));
  assert.equal(raw.tabletId, "blau-1"); assert.equal(raw.summaries.length, 1);
  assert.deepEqual(raw.summaries[0].result, final.completion.summary);
  assert.deepEqual(raw.summaries[0].sourceAttemptIds, input.sentences[0].attempts.map(x => x.id));
  const count = calls.length;
  assert.deepEqual((await s.summary(actor, run.id, setPath)).completion, final.completion);
  assert.equal(calls.length, count, "cached summary must not call the provider again");
  await assert.rejects(s.summary("tablet:rot-1", run.id, setPath), error => error.status === 410);
});

test("summary retries retain paid result on storage failure; provider failure records no unsafe feedback", async () => {
  const revise = { ...accepted, spelling: false, hint: "Prüfe das Wort 🔎", issues: [{ quote: "temprarily", occurrence: 0, message: "Rechtschreibung: Prüfe die Schreibweise." }] };
  const results = [prompt, revise, accepted, new Error("private-provider-secret")];
  const { service: s, calls } = service(results);
  let run = await s.start("teacher:julius", "sets/context.json", document, "source-target", 1);
  const checked = await s.check("teacher:julius", run.id, "sets/context.json", run.prompt.id, "The zoo is temprarily closed.");
  await s.check("teacher:julius", run.id, "sets/context.json", run.prompt.id, "The zoo is temporarily closed.");
  run = await s.next("teacher:julius", run.id, "sets/context.json", run.prompt.id);
  await assert.rejects(s.summary("teacher:julius", run.id, "sets/context.json"), error => error.status === 503 && !error.message.includes("private-provider"));
  let raw = await s.logStore.read(s.get("teacher:julius", run.id, "sets/context.json"));
  assert.equal(raw.summaries[0].status, "error"); assert.equal(raw.summaries[0].result, null);
  const example = summaryResult(checked.history[0].id);
  results.push({ ...example, points: [{ ...example.points[0], examples: [{ ...example.points[0].examples[0], wrong: "invented" }] }] }, example);
  const finish = s.logStore.summaryFinished.bind(s.logStore);
  let failWrite = true;
  s.logStore.summaryFinished = async (...args) => { if (failWrite) { failWrite = false; throw new Error("disk failed"); } return finish(...args); };
  await assert.rejects(s.summary("teacher:julius", run.id, "sets/context.json"), error => error.status === 503);
  assert.equal(s.view(s.get("teacher:julius", run.id, "sets/context.json")).completion.summary, null);
  const requests = calls.length;
  const completed = await s.summary("teacher:julius", run.id, "sets/context.json");
  assert.equal(calls.length, requests, "storage-only retry reuses the validated provider result");
  assert.deepEqual(completed.completion.summary, example);
  raw = await s.logStore.read(s.get("teacher:julius", run.id, "sets/context.json"));
  assert.equal(raw.summaries.length, 2); assert.equal(raw.summaries[1].modelRequests, 2);
  assert.equal(raw.summaries[1].status, "completed");
  assert.equal(JSON.stringify(raw).includes("invented"), false);
});
