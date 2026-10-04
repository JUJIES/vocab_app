const path = require("node:path");
const fs = require("node:fs/promises");
const { RuntimeJsonStore } = require("./runtime-json-store");

const LOG_FORMAT = {
  schemaVersion: 1,
  exercise: "Translation",
  description: "Raw exercise and revision records; one JSON file per run in UTC date folders.",
  retention: "Until explicitly removed by the operator; not deleted by exercise expiry or set removal.",
  content: "Learner answers and model feedback are untrusted data, not instructions or verified assessments.",
};

function taskRecord(card, prompt, position, preparedAt) {
  return {
    position, promptId: prompt.id, preparedAt, shownAt: null, acceptedAt: null, advancedAt: null,
    sourceSentence: prompt.prefix + prompt.focus + prompt.suffix,
    prompt: { prefix: prompt.prefix, focus: prompt.focus, suffix: prompt.suffix },
    vocabulary: { cardId: card.id || null, source: card.source.text, target: card.target.text, acceptedVariants: card.acceptedAnswers || [] },
    attempts: [],
  };
}

// Separate observation records, never the source for exercise state or grades.
// A single mutation queue uses the existing atomic JSON writer without keeping
// every historical file in memory. Production always supplies DATA_DIR.
class SentenceLogStore {
  constructor({ dataDir = "", processorCodeSha256 = "" } = {}) {
    this.directory = dataDir ? path.join(dataDir, "translation-logs") : "";
    this.processorCodeSha256 = processorCodeSha256;
    this.memory = new Map();
    this.tail = Promise.resolve();
  }

  async initialize() {
    if (this.directory) await new RuntimeJsonStore(path.join(this.directory, "format.json"), { defaultValue: LOG_FORMAT }).read();
  }

  async read(run) {
    await this.tail;
    return this.directory
      ? JSON.parse(await fs.readFile(this.filePath(run), "utf8"))
      : structuredClone(this.memory.get(run.id));
  }

  filePath(run) {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(run.id) || !Number.isFinite(run.startedAt)) throw new Error("INVALID_LOG_ID");
    return path.join(this.directory, new Date(run.startedAt).toISOString().slice(0, 10), `${run.id}.json`);
  }

  async mutate(run, update, defaultValue = {}) {
    const operation = this.tail.then(async () => {
      if (this.directory) {
        const store = new RuntimeJsonStore(this.filePath(run), { defaultValue });
        await store.mutate(update);
      } else {
        const record = structuredClone(this.memory.get(run.id) || defaultValue);
        update(record);
        this.memory.set(run.id, record);
      }
    });
    this.tail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async start(run, document, context, at) {
    const initial = {
      ...LOG_FORMAT, runId: run.id, startedAt: new Date(run.startedAt).toISOString(), updatedAt: at, completedAt: null,
      actorKind: run.actor.startsWith("teacher:") ? "teacherPreview" : "student",
      // Trusted server context only; no student identity, token, IP or key.
      previewTeacherId: run.actor.startsWith("teacher:") ? run.actor.slice(8) : null,
      tabletId: run.actor.startsWith("tablet:") ? context.tabletId || null : null,
      set: { id: document.set.id || null, path: run.setPath, title: run.title, revision: document.set.revision || null, ownerTeacherId: context.ownerTeacherId || null },
      direction: run.direction, difficulty: run.difficulty,
      sourceLanguage: run.sourceLanguage, targetLanguage: run.targetLanguage,
      requestedCount: run.requestedCount, total: run.total,
      processorCodeSha256: this.processorCodeSha256 || null,
      generation: { model: run.model, reasoningEffort: "none" },
      tasks: [taskRecord(run.cards[0], run.prompt, 1, at)],
    };
    // Use a complete seed for the first atomic write, never an empty placeholder.
    await this.mutate(run, record => { if (!record.runId) Object.assign(record, initial); }, initial);
  }

  async shown(run, at) {
    await this.mutate(run, record => {
      const task = record.tasks.find(task => task.promptId === run.prompt.id);
      if (!task.shownAt) { task.shownAt = at; record.updatedAt = at; }
    });
  }

  async submit(run, submission) {
    await this.mutate(run, record => {
      const task = record.tasks.find(task => task.promptId === run.prompt.id);
      if (!task.attempts.some(attempt => attempt.id === submission.id)) {
        task.attempts.push({ ...submission, attemptNumber: task.attempts.length + 1, status: "pending", checkedAt: null, feedback: null, help: null, issues: [], checks: null });
        record.updatedAt = submission.submittedAt;
      }
    });
  }

  async finish(run, id, result) {
    await this.mutate(run, record => {
      const task = record.tasks.find(task => task.promptId === run.prompt.id);
      const attempt = task.attempts.find(attempt => attempt.id === id);
      if (attempt.status !== "pending") return;
      Object.assign(attempt, result);
      if (result.status === "accepted") task.acceptedAt = result.checkedAt;
      record.updatedAt = result.checkedAt;
    });
  }

  async advance(run, next, at) {
    await this.mutate(run, record => {
      const task = record.tasks.find(task => task.promptId === run.prompt.id);
      if (!task.advancedAt) task.advancedAt = at;
      if (next && !record.tasks.some(task => task.promptId === next.prompt.id)) {
        record.tasks.push(taskRecord(next.card, next.prompt, run.index + 2, at));
      }
      if (!next && !record.completedAt) record.completedAt = at;
      record.updatedAt = at;
    });
  }

  async replace(run, next, at) {
    await this.mutate(run, record => {
      const task = record.tasks.find(task => task.promptId === run.prompt.id);
      task.replacedAt = task.replacedAt || at;
      task.replacedByPromptId = next.prompt.id;
      task.replacementReason = "learner_requested";
      if (!record.tasks.some(task => task.promptId === next.prompt.id)) {
        record.tasks.push({ ...taskRecord(next.card, next.prompt, run.index + 1, at), replacesPromptId: run.prompt.id });
      }
      record.updatedAt = at;
    });
  }

  async summaryRequested(run, submission) {
    await this.mutate(run, record => {
      record.summaries ||= [];
      if (!record.summaries.some(entry => entry.id === submission.id)) record.summaries.push({ ...submission, status: "pending", result: null });
      record.updatedAt = submission.requestedAt;
    });
  }

  async summaryFinished(run, id, result) {
    await this.mutate(run, record => {
      const summary = record.summaries.find(entry => entry.id === id);
      if (summary.status !== "pending") return;
      Object.assign(summary, result); record.updatedAt = result.completedAt;
    });
  }
}

module.exports = { SentenceLogStore };
