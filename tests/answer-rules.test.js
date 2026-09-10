const test = require("node:test");
const assert = require("node:assert/strict");
const answerRules = require("../answer-rules");

test("answer comparison ignores case, repeated whitespace and sentence punctuation", () => {
  const expected = answerRules.normalizeForComparison("Authorities: Which safety rules apply");

  assert.equal(
    answerRules.normalizeForComparison("  AUTHORITIES: “Which safety rules apply?”  "),
    expected,
  );
  assert.equal(answerRules.normalizeForComparison("I  agree, because …"), "i agree because");
  assert.equal(answerRules.normalizeForComparison("car–sharing"), "car-sharing");
  assert.equal(answerRules.normalizeForComparison("can’t"), "can't");
  assert.notEqual(
    answerRules.normalizeForComparison("now here"),
    answerRules.normalizeForComparison("nowhere"),
  );
});

test("answer comparison keeps letters, digits and diacritics meaningful", () => {
  assert.notEqual(
    answerRules.normalizeForComparison("schön"),
    answerRules.normalizeForComparison("schon"),
  );
  assert.notEqual(
    answerRules.normalizeForComparison("route 5"),
    answerRules.normalizeForComparison("route 6"),
  );
});

test("sentence punctuation is ignored while word spelling remains exact", () => {
  assert.equal(
    answerRules.evaluate("Authorities Which safety rules apply", [
      "Authorities: “Which safety rules apply?”",
    ]).status,
    "correct",
  );
  assert.equal(
    answerRules.evaluate("Which security rules apply?", ["Which safety rules apply?"]).status,
    "wrong",
  );
  assert.notEqual(answerRules.evaluate("cant", ["can't"]).status, "correct");
  assert.notEqual(answerRules.evaluate("wellknown", ["well-known"]).status, "correct");
  assert.equal(answerRules.evaluate("email", ["e-mail", "email"]).status, "correct");
});

test("display equivalence hides forms but preserves genuine synonyms", () => {
  assert.equal(
    answerRules.areEquivalentDisplayForms("motorized vehicle", "motorised vehicle", { language: "en" }),
    true,
  );
  assert.equal(
    answerRules.areEquivalentDisplayForms("to pull a suitcase", "pull a suitcase", { language: "en" }),
    true,
  );
  assert.equal(
    answerRules.areEquivalentDisplayForms("motorized vehicle", "a motorized vehicle", { language: "en" }),
    true,
  );
  assert.equal(
    answerRules.areEquivalentDisplayForms("e-mail", "email", { language: "en" }),
    true,
  );
  assert.equal(
    answerRules.areEquivalentDisplayForms("motorized vehicle", "powered vehicle", { language: "en" }),
    false,
  );
  assert.equal(
    answerRules.areEquivalentDisplayForms("der Wand", "an der Wand", { language: "de" }),
    false,
  );
});
