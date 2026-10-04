const test = require("node:test");
const assert = require("node:assert/strict");
const { parts, plain, append } = require("../sentence-feedback-text");

test("language references distinguish pronouns, infinitives, contractions and legacy quotes", () => {
  const text = "Bei `I` steht die Grundform von `to have`; „He ist nicht“ enthält noch Deutsch. Prüfe auch “I'm” und \"-s\".";
  assert.deepEqual(parts(text).filter(part => part.reference).map(part => part.text), ["I", "to have", "He ist nicht", "I'm", "-s"]);
  assert.equal(plain(text), "Bei I steht die Grundform von to have; He ist nicht enthält noch Deutsch. Prüfe auch I'm und -s.");
  assert.equal(plain("I'm sick today."), "I'm sick today.", "apostrophes are not delimiters");
  assert.equal(plain("Das ist Simple Present."), "Das ist Simple Present.", "no guessing of words or grammar categories");
});

test("malformed markers and HTML stay literal; renderer creates only text-bearing nodes", () => {
  for (const text of ["`to have", "` `", "`<img onerror=x>`", "`two\nlines`", "`" + "x".repeat(101) + "`", "**I**", "[I](https://example.com)"]) assert.equal(plain(text), text);
  const nodes = [];
  const element = { ownerDocument: { createElement: tag => ({ tag }), createTextNode: textContent => ({ tag: "#text", textContent }) }, append: node => nodes.push(node) };
  append(element, "Nach `I` <img src=x onerror=alert(1)> weiter.");
  assert.deepEqual(nodes.map(node => [node.tag, node.textContent]), [["#text", "Nach "], ["i", "I"], ["#text", " <img src=x onerror=alert(1)> weiter."]]);
  assert.equal(nodes[1].className, "sentence-stage__language-form");
  assert.ok(nodes.every(node => !("innerHTML" in node)));
});
