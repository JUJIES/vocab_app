const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { SetService } = require("../lib/set-service");
const { TeacherService } = require("../lib/teacher-service");

async function waitForHealth(origin, child) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null) throw new Error("Testserver exited before health check");
    try { if ((await fetch(`${origin}/health`)).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Testserver did not start");
}

test("the real API logs student loops from multiple teachers, preserves files across restart and never serves them publicly", async context => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "translation-api-"));
  const seedPath = path.join(__dirname, "..", "data", "teachers.seed.json");
  const teachers = new TeacherService({ dataDir, seedPath });
  const credentials = await teachers.provisionInitialPasswords();
  const sets = new SetService({ dataDir });
  const owned = [];
  for (const teacherId of ["julius", "aksana"]) {
    owned.push(await sets.createSet(teacherId, { title: `Translation ${teacherId}`, sidePreset: "languages", sourceLanguage: "de", targetLanguage: "en", sourceLabel: "Deutsch", targetLabel: "Englisch", cards: [{ front: "Wartung", back: "maintenance" }] }));
  }

  // A test-only preload replaces the paid provider inside the real child server.
  // No production flag, test endpoint, key or validation bypass is introduced.
  const preloadPath = path.join(dataDir, "provider-fixture.cjs");
  await fs.writeFile(preloadPath, `require.cache[${JSON.stringify(require.resolve("openai"))}] = { exports: class FixtureOpenAI {
    constructor() { this.responses = { create: async body => {
      const data = JSON.parse(body.input[0].content);
      if (data.learner_answer === "MODEL_FAIL") throw Error("private-provider-error");
      const result = body.text.format.name === "sentence_summary"
        ? { praise: "Du hast alle Sätze passend übersetzt 👍", points: [] }
        : body.text.format.name === "sentence_prompt"
        ? { complete: true, prefix: data.previous_source_sentences?.length ? "Das Auto braucht regelmäßige " : "Das Fahrrad braucht regelmäßige ", focus: data.source_expression, suffix: "." }
        : { grammar: true, meaning: data.learner_answer.includes("regular"), target: true, spelling: true,
          hint: data.learner_answer.includes("regular") ? "Jetzt ist die Häufigkeit auch dabei 🌟" : "Die Vokabel passt 👍",
          issues: data.learner_answer.includes("regular") ? [] : [{ quote: null, occurrence: 0, message: "In der Vorlage steht regelmäßige. Ergänze auch diese Häufigkeit." }], help: null };
      return { status: "completed", output_text: JSON.stringify(result) };
    } }; }
  } };\n`);
  const port = 7800 + Math.floor(Math.random() * 300);
  const origin = `http://127.0.0.1:${port}`;
  let child;
  async function stop() {
    if (child && child.exitCode === null) { const closed = once(child, "close"); child.kill("SIGTERM"); await closed; }
  }
  context.after(async () => { await stop(); await fs.rm(dataDir, { recursive: true, force: true }); });
  async function start() {
    child = spawn(process.execPath, ["--require", preloadPath, "server.js"], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), HOST: "127.0.0.1", HTTPS_PORT: "0", OPENAI_SENTENCE_API_KEY: "synthetic-test-key" },
      stdio: "ignore",
    });
    await waitForHealth(origin, child);
  }
  async function post(endpoint, body, headers = {}) {
    return fetch(`${origin}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  }
  async function practice(action, body, headers) {
    const response = await post(`/api/sentence-practice/${action}`, body, headers);
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    return (await response.json()).run;
  }
  async function logFiles() {
    const directory = path.join(dataDir, "translation-logs");
    const files = [];
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) if (entry.isDirectory()) {
      for (const name of await fs.readdir(path.join(directory, entry.name))) if (name.endsWith(".json")) files.push(path.join(directory, entry.name, name));
    }
    return files;
  }

  await start();
  assert.equal(JSON.parse(await fs.readFile(path.join(dataDir, "translation-logs", "format.json"), "utf8")).exercise, "Translation");
  const unauthorized = await post("/api/sentence-practice/start", { setPath: owned[0].path, count: 1 });
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(await logFiles(), []);
  const registration = await post("/api/tablets/blau-1/register", { pin: "1234" });
  assert.equal(registration.status, 200);
  const token = (await registration.json()).session.token;
  const studentHeaders = { Authorization: `Bearer ${token}` };
  const runs = [];
  for (const set of owned) {
    const subscription = await post("/api/tablets/blau-1/subscriptions", { setPath: set.path }, studentHeaders);
    assert.equal(subscription.status, 200);
    const body = { tabletId: "blau-1", setPath: set.path };
    let run = await practice("start", { ...body, count: 1, difficulty: "easy", ownerTeacherId: "forged-client-owner" }, studentHeaders);
    const identifiers = { ...body, id: run.id, promptId: run.prompt.id };
    assert.equal((await post("/api/sentence-practice/summary", identifiers, studentHeaders)).status, 409);
    await practice("shown", identifiers, studentHeaders);
    const revised = await practice("check", { ...identifiers, answer: "My bike needs maintenance." }, studentHeaders);
    assert.equal(revised.accepted, false);
    await practice("check", { ...identifiers, answer: "My bike needs maintenance." }, studentHeaders);
    if (set === owned[0]) {
      const replacement = await practice("replace", identifiers, studentHeaders);
      assert.equal(replacement.position, 1); assert.equal(replacement.total, 1);
      identifiers.promptId = replacement.prompt.id;
      await practice("shown", identifiers, studentHeaders);
    }
    const failed = await post("/api/sentence-practice/check", { ...identifiers, answer: "MODEL_FAIL" }, studentHeaders);
    assert.equal(failed.status, 503);
    run = await practice("check", { ...identifiers, answer: set === owned[0] ? "My car needs regular maintenance." : "My bike needs regular maintenance." }, studentHeaders);
    assert.equal(run.accepted, true);
    assert.equal(run.history.length, set === owned[0] ? 1 : 2);
    const completed = await practice("next", identifiers, studentHeaders);
    assert.equal(completed.complete, true);
    assert.equal(completed.completion.sentences[0].attemptCount, set === owned[0] ? 1 : 2);
    assert.equal((await post("/api/sentence-practice/summary", identifiers)).status, 401);
    const summarized = await practice("summary", identifiers, studentHeaders);
    assert.ok(summarized.completion.summary.praise);
    assert.deepEqual((await practice("summary", identifiers, studentHeaders)).completion, summarized.completion);
    runs.push({ run, revised });
  }
  const account = credentials.find(entry => entry.id === "aksana");
  const login = await post("/api/teacher/session", { teacherId: account.id, password: account.initialPassword });
  assert.equal(login.status, 200);
  const teacherHeaders = { Cookie: login.headers.get("set-cookie").split(";")[0] };
  const preview = await practice("start", { setPath: owned[1].path, count: 1 }, teacherHeaders);
  const originalPreview = { setPath: owned[1].path, id: preview.id, promptId: preview.prompt.id };
  const previewRevision = await practice("check", { ...originalPreview, answer: "My bike needs maintenance." }, teacherHeaders);
  assert.equal((await post("/api/sentence-practice/replace", originalPreview)).status, 401);
  const replacement = await practice("replace", originalPreview, teacherHeaders);
  assert.equal(replacement.position, 1); assert.equal(replacement.total, 1);
  assert.deepEqual(replacement.history, []); assert.equal(replacement.shown, false);
  assert.equal((await practice("replace", originalPreview, teacherHeaders)).prompt.id, replacement.prompt.id);
  assert.equal((await post("/api/sentence-practice/check", { ...originalPreview, answer: "Old answer" }, teacherHeaders)).status, 409);
  const previewResult = await practice("check", { ...originalPreview, promptId: replacement.prompt.id, answer: "My car needs regular maintenance." }, teacherHeaders);

  const files = await logFiles();
  assert.equal(files.length, 3);
  const contents = await Promise.all(files.map(file => fs.readFile(file, "utf8")));
  const records = contents.map(JSON.parse);
  for (let index = 0; index < owned.length; index++) {
    const record = records.find(record => record.runId === runs[index].run.id);
    assert.equal(record.set.ownerTeacherId, ["julius", "aksana"][index]);
    assert.equal(record.set.id, owned[index].id);
    assert.equal(record.actorKind, "student");
    assert.ok(record.completedAt);
    const attempts = record.tasks.flatMap(task => task.attempts);
    assert.deepEqual(attempts.map(attempt => attempt.status), ["revise", "error", "accepted"]);
    assert.deepEqual(attempts.map(attempt => attempt.attemptNumber), index === 0 ? [1, 1, 2] : [1, 2, 3]);
    assert.equal(attempts[0].feedback, runs[index].revised.feedback);
    assert.equal(attempts[2].feedback, runs[index].run.feedback);
    assert.deepEqual(attempts[2].previousAttemptIds, index === 0 ? [] : [attempts[0].id]);
    assert.match(record.processorCodeSha256, /^[a-f0-9]{64}$/);
    assert.equal(record.tabletId, "blau-1", "trusted device ID now supports the requested longitudinal evaluation");
    assert.equal(record.summaries.length, 1);
    assert.equal(record.summaries[0].status, "completed");
    assert.ok(record.summaries[0].result.praise);
    assert.equal(JSON.stringify(record).includes(token), false);
    assert.equal(JSON.stringify(record).includes("synthetic-test-key"), false);
  }
  const previewRecord = records.find(record => record.runId === preview.id);
  assert.equal(previewRecord.actorKind, "teacherPreview");
  assert.equal(previewRecord.previewTeacherId, "aksana");
  assert.equal(previewRecord.completedAt, null);
  assert.equal(previewRecord.tasks.length, 2);
  assert.equal(previewRecord.tasks[0].attempts[0].feedback, previewRevision.feedback);
  assert.equal(previewRecord.tasks[0].replacedByPromptId, replacement.prompt.id);
  assert.equal(previewRecord.tasks[0].acceptedAt, null);
  assert.equal(previewRecord.tasks[1].attempts[0].feedback, previewResult.feedback);
  assert.deepEqual(previewRecord.tasks[1].attempts[0].previousAttemptIds, []);
  assert.ok(previewRecord.tasks[1].shownAt);
  const relative = path.relative(dataDir, files[0]).split(path.sep).join("/");
  for (const headers of [{}, teacherHeaders, studentHeaders]) {
    assert.equal((await fetch(`${origin}/data/${relative}`, { headers })).status, 404);
    assert.equal((await fetch(`${origin}/${relative}`, { headers })).status, 404);
  }

  await stop();
  await start();
  assert.deepEqual(await Promise.all(files.map(file => fs.readFile(file, "utf8"))), contents);
  const expired = await post("/api/sentence-practice/resume", { tabletId: "blau-1", setPath: owned[0].path, id: runs[0].run.id }, studentHeaders);
  assert.equal(expired.status, 410, "durable observation logs do not become a second live exercise state");
});
