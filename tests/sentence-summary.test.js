const test = require("node:test");
const assert = require("node:assert/strict");
const { completion, summaryInput, validSummary } = require("../lib/sentence-summary");

const revision = (id, answer, quote) => ({ id, status: "revise", checkedAnswer: answer, feedback: "Verbform prüfen", issues: [{ quote, message: "Wortstellung: Passe die Form an." }], checks: { grammar: false } });
const accepted = { id: "ok", status: "accepted", checkedAnswer: "This is correct.", feedback: "Passt 👍", issues: [], checks: { grammar: true } };
function record() {
  return { sourceLanguage: "de", targetLanguage: "en", tasks: [
    { promptId: "old", sourceSentence: "Alter Kontext.", replacedByPromptId: "new", attempts: [revision("old-a", "Bad old answer", "Bad")] },
    { promptId: "new", sourceSentence: "Das ist richtig.", acceptedAt: "now", advancedAt: "now", attempts: [
      revision("a1", "This are correct.", "are"), { id: "error", status: "error" }, { id: "uncertain", status: "uncertain" },
      revision("a2", "This were correct.", "were"), revision("a3", "This am correct.", "am"), revision("a4", "This be correct.", "be"), accepted,
    ] },
  ] };
}
test("completion counts assessed attempts for each solved context, without technical calls or replaced tasks", () => {
  const data = record();
  assert.deepEqual(completion(data), { sentences: [{ promptId: "new", sourceSentence: "Das ist richtig.", answer: "This is correct.", attemptCount: 5 }], summary: null });
  const input = summaryInput(data);
  assert.deepEqual(input.sentences[0].attempts.map(attempt => attempt.id), ["a1", "a2", "a4", "ok"]);
  assert.equal(input.sentences[0].attemptCount, 5);
  assert.equal(input.sentences[0].attempts[0].checks.grammar, false);
  assert.equal(data.tasks[1].attempts.length, 7, "projection never changes the raw history");
});
test("summary examples cite actual errors and whole corrections from the same accepted sentence", () => {
  const input = summaryInput(record());
  const result = { praise: "Gut verbessert 👍", points: [{ title: "Verbform", tip: "Achte auf die Form von `to be`.", examples: [{ attemptId: "a1", wrong: "are", right: "is" }] }] };
  assert.equal(validSummary(result, input), true, "is in This is must match the separate word, not the substring in This");
  for (const example of [
    { attemptId: "other", wrong: "are", right: "is" }, { attemptId: "old-a", wrong: "Bad", right: "is" },
    { attemptId: "a1", wrong: "This", right: "That" }, { attemptId: "a1", wrong: "are", right: "correctly" },
    { attemptId: "a1", wrong: "are", right: "Thi" },
  ]) assert.equal(validSummary({ ...result, points: [{ ...result.points[0], examples: [example] }] }, input), false);
  assert.equal(validSummary({ ...result, praise: "<script>" }, input), false);
  assert.equal(validSummary({ ...result, points: Array(4).fill(result.points[0]) }, input), false);
  assert.equal(validSummary({ ...result, points: [{ ...result.points[0], examples: [result.points[0].examples[0], result.points[0].examples[0]] }] }, input), false);
});
test("error-free completion does not invent future problem categories and returns the stored summary", () => {
  const data = record(); data.tasks[1].attempts = [accepted];
  const input = summaryInput(data);
  const result = { praise: "Alles gleich passend übersetzt 🎉", points: [] };
  assert.equal(validSummary(result, input), true);
  assert.equal(validSummary({ ...result, points: [{ title: "Zeitform", tip: "Du verwechselst Zeiten.", examples: [] }] }, input), false);
  data.summaries = [{ status: "error", result: null }, { status: "completed", result }];
  assert.deepEqual(completion(data).summary, result);
});
