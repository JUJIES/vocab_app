const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildAnswerGroups,
  evaluateInputs,
  parseForms,
} = require("../irregular-verbs");

test("irregular verb forms require exactly three deliberately separated values", () => {
  assert.deepEqual(parseForms("shine - shone - shone"), ["shine", "shone", "shone"]);
  assert.deepEqual(parseForms("get up – got up – got up"), ["get up", "got up", "got up"]);
  assert.equal(parseForms("well-known"), null);
  assert.equal(parseForms("shine - shone"), null);
  assert.equal(parseForms("shine-shone-shone"), null);
});

test("alternative irregular forms are accepted in their matching field", () => {
  assert.deepEqual(
    buildAnswerGroups("learn - learnt - learnt", ["learn - learned - learned"]),
    [
      ["learn"],
      ["learnt", "learned"],
      ["learnt", "learned"],
    ],
  );
  assert.deepEqual(
    buildAnswerGroups(
      "shine - shone - shone",
      ["shine - shined - shined; shine - shone - shone"],
    ),
    [
      ["shine"],
      ["shone", "shined"],
      ["shone", "shined"],
    ],
  );
});

test("all three irregular verb fields must be correct", () => {
  const exactEvaluator = (input, answers) => ({
    status: answers.includes(input) ? "correct" : "wrong",
    normalizedInput: input,
    bestAnswer: answers[0],
    distance: answers.includes(input) ? 0 : 1,
  });
  const groups = buildAnswerGroups("shine - shone - shone");
  const correct = evaluateInputs(["shine", "shone", "shone"], groups, exactEvaluator);
  const wrong = evaluateInputs(["shine", "shined", "shone"], groups, exactEvaluator);

  assert.equal(correct.status, "correct");
  assert.equal(wrong.status, "wrong");
  assert.deepEqual(wrong.rawInputs, ["shine", "shined", "shone"]);
  assert.equal(wrong.bestAnswer, "shine · shone · shone");
});
