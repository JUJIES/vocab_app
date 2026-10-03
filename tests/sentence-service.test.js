const test = require("node:test");
const assert = require("node:assert/strict");
const { SentenceService } = require("../lib/sentence-service");
const document = { set: { title: "Context", languages: { source: "de", target: "en" } }, cards: [{ source: { text: "vorübergehend" }, target: { text: "temporarily" }, acceptedAnswers: ["for a while"] }] };
const prompt = { prefix: "Der Zoo ist ", focus: "vorübergehend", suffix: " geschlossen." };
const accepted = { grammar: true, meaning: true, target: true, hint: "Gut." };
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
  assert.equal(calls[0].store, false);
  await s.check("tablet:a", run.id, "sets/a.json", run.prompt.id, "The zoo is temporarily closed.");
  assert.equal(calls.length, 2);
  assert.equal((await s.next("tablet:a", run.id, "sets/a.json", run.prompt.id)).complete, true);
});
test("brief feedback permits revision, uncertainty never accepts, provider error preserves retry", async () => {
  const { service: s, calls } = service([prompt, { ...accepted, grammar: false, hint: "Die Vokabel passt. Achte auf die Form von be." }, { ...accepted, meaning: null }, new Error("provider-secret"), accepted]);
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
