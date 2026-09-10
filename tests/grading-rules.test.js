const test = require("node:test");
const assert = require("node:assert/strict");

const { summarizeResult } = require("../grading-rules.js");

test("summarizeResult follows the IHK percentage boundaries", () => {
  const boundaries = [
    [100, 1], [92, 1],
    [91, 2], [81, 2],
    [80, 3], [67, 3],
    [66, 4], [50, 4],
    [49, 5], [30, 5],
    [29, 6], [0, 6],
  ];

  for (const [percent, expectedGrade] of boundaries) {
    assert.equal(summarizeResult(percent, 100).grade, expectedGrade);
  }
});

test("summarizeResult calculates a rounded, bounded first-check result", () => {
  assert.deepEqual(summarizeResult(6, 10), {
    correctCount: 6,
    totalCount: 10,
    percent: 60,
    grade: 4,
  });
  assert.deepEqual(summarizeResult(9, 12), {
    correctCount: 9,
    totalCount: 12,
    percent: 75,
    grade: 3,
  });
  assert.deepEqual(summarizeResult(15, 10), {
    correctCount: 10,
    totalCount: 10,
    percent: 100,
    grade: 1,
  });
});
