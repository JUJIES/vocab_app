const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { SentenceService } = require("../lib/sentence-service");
const { SentenceLogStore } = require("../lib/sentence-log-store");

const document = { set: { id: "context", title: "Context", revision: 7, languages: { source: "de", target: "en" } },
  cards: [{ id: "temporary", source: { text: "vorübergehend" }, target: { text: "temporarily" }, acceptedAnswers: ["for a while"] }] };
const accepted = { grammar: true, meaning: true, target: true, spelling: true, hint: "Jetzt stimmt die Verbform 🌟", help: null, issues: [] };
const revision = { ...accepted, grammar: false, hint: "Die Vokabel passt 👍", issues: [{ quote: "ist", occurrence: 0, message: "Dieser Teil ist noch Deutsch. Wähle die passende englische Verbform." }],
  help: { explanation: "Ein englischer Satz braucht auch ein englisches Verb.", example: "The dog is tired." } };

async function fixture(context, results = [accepted], logStore) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "translation-logs-"));
  context.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  const logs = logStore || new SentenceLogStore({ dataDir, processorCodeSha256: "processor-test" });
  await logs.initialize();
  let clock = Date.parse("2026-10-03T21:59:00Z");
  const calls = [];
  const service = new SentenceService({ logStore: logs, now: () => clock, client: { responses: { create: async body => {
    calls.push(body);
    const input = JSON.parse(body.input[0].content);
    const result = body.text.format.name === "sentence_prompt"
      ? { complete: true, prefix: "Der Zoo ist ", focus: input.source_expression, suffix: " geschlossen." } : results.shift();
    clock += 1000;
    if (result instanceof Error) throw result;
    return { status: "completed", output_text: JSON.stringify(result) };
  } } } });
  const start = (actor = "tablet:private-tablet-id", doc = document, owner = "aksana") => service.start(actor, "sets/context.json", doc, "source-target", doc.cards.length, "easy", { ownerTeacherId: owner });
  const read = run => fs.readFile(logs.filePath(service.get("tablet:private-tablet-id", run.id, "sets/context.json")), "utf8").then(JSON.parse);
  return { logs, dataDir, service, calls, start, read, tick: ms => { clock += ms; } };
}

test("durable records retain every task, raw answer, feedback, help, flags and exact revision links", async context => {
  const f = await fixture(context, [revision, { ...accepted, meaning: null }, new Error("provider-private-key"), accepted, accepted]);
  const doc = { ...document, cards: [...document.cards, { id: "other", source: { text: "krank" }, target: { text: "sick" } }] };
  const run = await f.start(undefined, doc);
  const check = answer => f.service.check("tablet:private-tablet-id", run.id, "sets/context.json", run.prompt.id, answer);
  const first = await check("  The zoo ist temporarily closed.  ");
  await check("The zoo ist temporarily closed.");
  const second = await check("An uncertain sentence");
  await assert.rejects(check("The zoo is temporarily closed."), error => error.status === 503);
  const correct = await check("The zoo is temporarily closed.");
  await check("The zoo is temporarily closed.");
  let saved = await f.read(run);
  assert.equal(saved.schemaVersion, 1);
  assert.equal(saved.set.ownerTeacherId, "aksana");
  assert.equal(saved.set.revision, 7);
  assert.equal(saved.actorKind, "student");
  assert.equal(saved.previewTeacherId, null);
  assert.equal(saved.processorCodeSha256, "processor-test");
  const task = saved.tasks[0];
  assert.equal(task.sourceSentence, run.prompt.prefix + run.prompt.focus + run.prompt.suffix);
  assert.equal(task.vocabulary.target, f.service.get("tablet:private-tablet-id", run.id, "sets/context.json").cards[0].target.text);
  assert.deepEqual(task.attempts.map(a => a.status), ["revise", "uncertain", "error", "accepted"]);
  assert.equal(task.attempts[0].answer, "  The zoo ist temporarily closed.  ");
  assert.equal(task.attempts[0].checkedAnswer, first.checkedAnswer);
  assert.equal(task.attempts[0].feedback, first.feedback);
  assert.deepEqual(task.attempts[0].help, first.help);
  assert.deepEqual(task.attempts[0].issues, first.issues);
  assert.equal(task.attempts[1].feedback, second.feedback, "record the actual uncertainty message shown, not the discarded model hint");
  assert.equal(task.attempts[2].feedback, null);
  assert.equal(task.attempts[2].errorCode, "CHECK_UNAVAILABLE");
  assert.deepEqual(task.attempts[3].previousAttemptIds, [first.history[0].id, second.history[1].id]);
  assert.equal(task.attempts[3].id, correct.history[2].id);
  assert.equal(task.attempts[3].checks.spelling, true);
  assert.ok(task.shownAt && task.acceptedAt);
  for (const attempt of task.attempts) {
    assert.ok(Date.parse(attempt.checkedAt) >= Date.parse(attempt.submittedAt));
    assert.equal(attempt.durationMs, 1000);
    assert.equal(attempt.modelRequests, 1);
    assert.match(attempt.instructionsSha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(JSON.stringify(saved).includes("private-tablet-id"), false);
  assert.equal(JSON.stringify(saved).includes("provider-private-key"), false);
  assert.equal(JSON.stringify(correct).includes("checks"), false);
  assert.equal(JSON.stringify(correct).includes("processorCodeSha256"), false);
  const next = await f.service.next("tablet:private-tablet-id", run.id, "sets/context.json", run.prompt.id);
  assert.equal(next.history.length, 0);
  await f.service.next("tablet:private-tablet-id", run.id, "sets/context.json", run.prompt.id);
  saved = await f.read(run);
  assert.equal(saved.tasks.length, 2);
  assert.equal(saved.tasks[0].attempts.length, 4, "moving on must not erase previous raw records");
  assert.ok(saved.tasks[0].advancedAt);
  assert.equal(saved.tasks[1].shownAt, null);
  await f.service.check("tablet:private-tablet-id", run.id, "sets/context.json", next.prompt.id, "A correct second sentence.");
  await f.service.next("tablet:private-tablet-id", run.id, "sets/context.json", next.prompt.id);
  await f.service.next("tablet:private-tablet-id", run.id, "sets/context.json", next.prompt.id);
  saved = await f.read(run);
  assert.ok(saved.completedAt);
  assert.equal(saved.tasks[1].attempts.length, 1);
  const file = f.logs.filePath(f.service.get("tablet:private-tablet-id", run.id, "sets/context.json"));
  const bytes = await fs.readFile(file, "utf8");
  await f.service.clear("tablet:private-tablet-id");
  await new SentenceLogStore({ dataDir: f.dataDir }).initialize();
  assert.equal(await fs.readFile(file, "utf8"), bytes, "run expiry, reset and store restart do not delete the observation record");
});

test("an answer is already durable while the provider is pending; cancellation retains the attempt", async context => {
  const f = await fixture(context);
  const run = await f.start();
  let release;
  let notify;
  const called = new Promise(resolve => { notify = resolve; });
  f.service.client.responses.create = () => { notify(); return new Promise(resolve => { release = resolve; }); };
  const pending = f.service.check("tablet:private-tablet-id", run.id, "sets/context.json", run.prompt.id, "The zoo is temporarily closed.");
  await called;
  const file = f.logs.filePath(f.service.get("tablet:private-tablet-id", run.id, "sets/context.json"));
  const saved = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(saved.tasks[0].attempts[0].status, "pending");
  assert.equal(saved.tasks[0].attempts[0].feedback, null);
  await f.service.clear("tablet:private-tablet-id");
  release({ status: "completed", output_text: JSON.stringify(accepted) });
  await assert.rejects(pending, error => error.status === 410);
  assert.equal(JSON.parse(await fs.readFile(file, "utf8")).tasks[0].attempts[0].errorCode, "RUN_CANCELLED");
});

test("failed disk writes never return unlogged feedback, and retry saves the cached result without another paid call", async context => {
  const f = await fixture(context);
  const run = await f.start();
  const finish = f.logs.finish.bind(f.logs);
  let failOnce = true;
  f.logs.finish = async (...args) => { if (failOnce) { failOnce = false; throw Error("private filesystem path"); } return finish(...args); };
  const check = () => f.service.check("tablet:private-tablet-id", run.id, "sets/context.json", run.prompt.id, "The zoo is temporarily closed.");
  await assert.rejects(check(), error => error.status === 503 && !error.message.includes("private"));
  assert.equal(f.service.view(f.service.get("tablet:private-tablet-id", run.id, "sets/context.json")).history.length, 0);
  const before = await f.read(run);
  assert.equal(before.tasks[0].attempts[0].status, "pending");
  // Pure storage retries remain possible even after the model-call allowance.
  f.service.limits.get("tablet:private-tablet-id").check = 40;
  const correct = await check();
  assert.equal(correct.accepted, true);
  assert.equal(f.calls.length, 2);
  const after = await f.read(run);
  assert.equal(after.tasks[0].attempts.length, 1);
  assert.equal(after.tasks[0].attempts[0].id, before.tasks[0].attempts[0].id);
  assert.equal(after.tasks[0].attempts[0].feedback, correct.feedback);
  assert.equal(correct.history.length, 1);
});

test("submission write failure prevents the provider call; invalid and unrelated requests leave no attempt", async context => {
  const f = await fixture(context);
  const run = await f.start();
  const submit = f.logs.submit.bind(f.logs);
  f.logs.submit = async () => { throw Error("disk full"); };
  await assert.rejects(f.service.check("tablet:private-tablet-id", run.id, "sets/context.json", run.prompt.id, "A sentence"), error => error.status === 503);
  assert.equal(f.calls.length, 1);
  assert.equal((await f.read(run)).tasks[0].attempts.length, 0);
  f.logs.submit = submit;
  for (const [actor, promptId, answer] of [["tablet:other", run.prompt.id, "A sentence"], ["tablet:private-tablet-id", "stale", "A sentence"], ["tablet:private-tablet-id", run.prompt.id, "x".repeat(601)]]) {
    await assert.rejects(f.service.check(actor, run.id, "sets/context.json", promptId, answer));
  }
  assert.equal((await f.read(run)).tasks[0].attempts.length, 0);
  assert.equal((await f.service.check("tablet:private-tablet-id", run.id, "sets/context.json", run.prompt.id, "The zoo is temporarily closed.")).accepted, true);
});

test("retry after a failed task/finish write reuses the prepared task and completes only after persistence", async context => {
  const f = await fixture(context, [accepted, accepted]);
  const doc = { ...document, cards: [...document.cards, { id: "other", source: { text: "krank" }, target: { text: "sick" } }] };
  const run = await f.start(undefined, doc);
  await f.service.check("tablet:private-tablet-id", run.id, "sets/context.json", run.prompt.id, "A correct sentence.");
  const advance = f.logs.advance.bind(f.logs);
  let failOnce = true;
  f.logs.advance = async (...args) => { if (failOnce) { failOnce = false; throw Error("disk full"); } return advance(...args); };
  await assert.rejects(f.service.next("tablet:private-tablet-id", run.id, "sets/context.json", run.prompt.id), error => error.status === 503);
  assert.equal((await f.read(run)).tasks.length, 1);
  const next = await f.service.next("tablet:private-tablet-id", run.id, "sets/context.json", run.prompt.id);
  assert.equal(f.calls.length, 3, "one generation for the next task even when its write needs a retry");
  await f.service.check("tablet:private-tablet-id", run.id, "sets/context.json", next.prompt.id, "Another correct sentence.");
  failOnce = true;
  await assert.rejects(f.service.next("tablet:private-tablet-id", run.id, "sets/context.json", next.prompt.id), error => error.status === 503);
  assert.equal(f.service.get("tablet:private-tablet-id", run.id, "sets/context.json").complete, undefined);
  assert.equal((await f.read(run)).completedAt, null);
  assert.equal((await f.service.next("tablet:private-tablet-id", run.id, "sets/context.json", next.prompt.id)).complete, true);
  assert.ok((await f.read(run)).completedAt);
});

test("parallel learners and teacher previews have isolated records, including incomplete runs across UTC dates", async context => {
  const f = await fixture(context, [accepted, accepted, accepted]);
  const actors = ["tablet:one", "tablet:two", "teacher:julius"];
  const runs = await Promise.all(actors.map((actor, index) => f.start(actor, document, index === 1 ? "other-teacher" : "aksana")));
  f.tick(3 * 60 * 60 * 1000);
  await Promise.all(runs.map((run, index) => f.service.check(actors[index], run.id, "sets/context.json", run.prompt.id, "The zoo is temporarily closed.")));
  for (let index = 0; index < runs.length; index++) {
    const internal = f.service.get(actors[index], runs[index].id, "sets/context.json");
    const saved = JSON.parse(await fs.readFile(f.logs.filePath(internal), "utf8"));
    assert.equal(saved.tasks[0].attempts.length, 1);
    assert.equal(saved.completedAt, null, "accepted is not the same as pressing Weiter to complete the run");
    assert.equal(saved.previewTeacherId, index === 2 ? "julius" : null);
    assert.equal(saved.actorKind, index === 2 ? "teacherPreview" : "student");
    assert.equal(path.basename(path.dirname(f.logs.filePath(internal))), "2026-10-03", "later attempts remain in the original run file");
  }
});
