// Explicit paid generation probe, independent of the fixed-source feedback eval.
// Synthetic vocabulary only; review the actual sentences manually for grammar,
// collocation, usefulness and translation difficulty. No model-scored pass rate.
const fs = require("node:fs");
const path = require("node:path");
const { SentenceService } = require("../lib/sentence-service");
const { SentenceLogStore } = require("../lib/sentence-log-store");
const { buildSentenceGenerationReviewPrompt, generationReviewSchema } = require("../lib/sentence-generation-prompt");
const pairs = [
  ["wicker", "geflochtenes Material", "wicker"],
  ["look", "Blick", "look"],
  ["temporary", "vorübergehend", "temporarily"],
  ["expect", "erwarten", "to expect"],
  ["roadwork", "Straßenbauarbeiten", "roadwork"],
  ["included", "ist enthalten", "is included"],
  ["starter", "Ein Nachteil ist …", "One disadvantage is …"],
  ["arrive", "ankommen", "to arrive"],
  ["child", "Kind", "child"],
];
const ids = process.env.SENTENCE_GENERATION_EVAL_IDS?.split(",");
if (ids?.some(id => !pairs.some(pair => pair[0] === id))) throw Error("Unknown generation evaluation case");
const queue = pairs.filter(pair => !ids || ids.includes(pair[0])).flatMap(([id, de, en]) =>
  ["easy", "medium", "hard"].flatMap(level => ["source-target", "target-source"].map(direction => ({ id: `${id}-${level}-${direction}`, de, en, level, direction }))));
const outputAt = process.argv.indexOf("--output");
const output = outputAt >= 0 ? process.argv[outputAt + 1] : "tmp/sentence-generation/results.json";

(async () => {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const logs = new SentenceLogStore({ dataDir: process.env.SENTENCE_GENERATION_EVAL_DATA_DIR || path.join(path.dirname(output), "data") });
  await logs.initialize();
  const service = new SentenceService({ logStore: logs });
  if (!service.client) throw Error("A server-side API key is required for the paid generation probe");
  const records = [], metrics = [];
  const create = service.client.responses.create.bind(service.client.responses);
  service.client.responses.create = async body => {
    const input = JSON.parse(body.input[0].content), started = Date.now();
    try {
      const response = await create(body);
      metrics.push({ expression: input.source_expression, level: input.difficulty, kind: body.text.format.name, review: body.text.format.name === "sentence_prompt_review" && response.output_text ? JSON.parse(response.output_text) : null, durationMs: Date.now() - started,
        reasoningEffort: body.reasoning.effort, outputTokens: response.usage?.output_tokens,
        sourceSentence: input.source_sentence || null, reasoningTokens: response.usage?.output_tokens_details?.reasoning_tokens, status: response.status,
        incompleteReason: response.incomplete_details?.reason || null });
      return response;
    } catch (error) {
      metrics.push({ expression: input.source_expression, level: input.difficulty, kind: body.text.format.name, durationMs: Date.now() - started, errorName: error.name, status: error.status });
      throw error;
    }
  };
  if (process.argv.includes("--answer-controls")) {
    // Hold actual source forms constant to isolate the real semantic review and
    // learner assessment. This fixture supplies only generation, never reviews
    // or accepted answers; it is not a production provider flag.
    const assessedCreate = service.client.responses.create.bind(service.client.responses);
    let supplied;
    service.client.responses.create = body => body.text.format.name === "sentence_prompt"
      ? Promise.resolve({ status: "completed", output_text: JSON.stringify({ ...supplied, complete: true }) }) : assessedCreate(body);
    const controls = [
      ["case", "de", "geflochtenes Material", "wicker", "Der Korb aus geflochtenem Material ist leicht.", "geflochtenem Material", "The wicker basket is light."],
      ["verb", "en", "to expect", "erwarten", "She expects a reply.", "expects", "Sie erwartet eine Antwort."],
      ["predicate", "de", "ist enthalten", "is included", "Das Frühstück ist im Preis enthalten.", "enthalten", "Breakfast is included in the price."],
      ["separable", "de", "ankommen", "to arrive", "Der Zug kommt pünktlich an.", "kommt", "The train arrives on time."],
    ];
    for (const [id, language, source, target, sentence, focus, answer] of controls) {
      supplied = { sentence, focus };
      const actor = `teacher:synthetic-answer-${id}`, setPath = "sets/generation-evaluation.json";
      const document = { set: { title: `[Synthetic contextual answers] ${id}`, languages: { source: language, target: language === "de" ? "en" : "de" } }, cards: [{ id, source: { text: source }, target: { text: target } }] };
      let record;
      try {
        const run = await service.start(actor, setPath, document, "source-target", 1, "easy");
        const checked = await service.check(actor, run.id, setPath, run.prompt.id, answer);
        record = { id, sentence, focus, answer, runId: run.id, accepted: checked.accepted, feedback: checked.feedback,
          complete: checked.accepted && (await service.next(actor, run.id, setPath, run.prompt.id)).complete };
      } catch (_) { record = { id, sentence, focus, error: "CONTROL_UNAVAILABLE" }; }
      records.push(record);
      fs.writeFileSync(output, JSON.stringify({ model: service.model, records, metrics }, null, 2));
      console.log(JSON.stringify(record));
    }
    if (records.some(record => !record.complete)) process.exitCode = 1;
    return;
  }
  if (process.argv.includes("--review-controls")) {
    const controls = [
      ["case", "de", "Der Korb besteht aus geflochtenes Material.", "geflochtenes Material", "wicker", "easy", false],
      ["infinitive", "en", "We do not to expect to win the game today.", "to expect", "erwarten", "medium", false],
      ["complement", "de", "Nach dem Eingriff müssen die Patienten erwarten, auch wenn die Beschwerden zunächst nachlassen.", "erwarten", "to expect", "hard", false],
      ["word-order", "de", "Beim Hotelpreis ist enthalten das Frühstück, wenn du online buchst.", "ist enthalten", "is included", "medium", false],
      ["comma", "de", "Ein Nachteil ist dass der Bus abends selten fährt.", "Ein Nachteil ist", "One disadvantage is", "medium", false],
      ["valid-case", "de", "Für Körbe ist geflochtenes Material gut geeignet.", "geflochtenes Material", "wicker", "easy", true],
      ["valid-infinitive", "en", "It is not fair to expect an answer immediately.", "to expect", "erwarten", "medium", true],
      ["valid-look", "en", "I take a look at the map.", "look", "Blick", "easy", true],
      ["valid-case-inflection", "de", "Der Korb ist aus geflochtenem Material.", "geflochtenes Material", "wicker", "easy", true, "geflochtenem Material"],
      ["valid-verb-inflection", "en", "She expects a reply.", "to expect", "erwarten", "easy", true, "expects"],
      ["valid-separated-predicate", "de", "Das Frühstück ist im Preis enthalten.", "ist enthalten", "is included", "easy", true, "enthalten"],
      ["valid-separated-verb", "de", "Der Zug kommt pünktlich an.", "ankommen", "to arrive", "easy", true, "kommt"],
      ["valid-irregular-plural", "en", "Two children play in the park.", "child", "Kind", "easy", true, "children"],
      ["invalid-synonym", "de", "Wir hoffen auf gutes Wetter.", "erwarten", "to expect", "easy", false, "hoffen"],
      ["invalid-missing-component", "de", "Der Zug kommt pünktlich.", "ankommen", "to arrive", "easy", false, "kommt"],
      ["invalid-source-language", "de", "We expect a reply.", "erwarten", "to expect", "easy", false, "expect"],
      ["invalid-focus", "de", "Wir erwarten heute Besuch.", "erwarten", "to expect", "easy", false, "Besuch"],
    ];
    for (const [id, sourceLanguage, sourceSentence, expression, target, level, expected, focus = expression] of controls) {
      const review = await service.ask("sentence_prompt_review", generationReviewSchema, buildSentenceGenerationReviewPrompt(level), {
        source_language: sourceLanguage, target_language: sourceLanguage === "de" ? "en" : "de", difficulty: level,
        source_sentence: sourceSentence, source_expression: expression, target_vocabulary: target, focus,
      });
      const suitable = [review.grammar, review.natural, review.vocabulary, review.level].every(value => value === true);
      records.push({ id, sourceSentence, expected, suitable, review, pass: suitable === expected });
      fs.writeFileSync(output, JSON.stringify({ model: service.model, records, metrics }, null, 2));
      console.log(JSON.stringify(records.at(-1)));
    }
    if (records.some(record => !record.pass)) process.exitCode = 1;
    return;
  }
  async function worker() {
    while (queue.length) {
      const item = queue.shift(), started = Date.now();
      let record;
      try {
        const document = { set: { title: `[Synthetic generation ${new Date().toISOString().slice(0, 10)}] ${item.id}`, languages: { source: "de", target: "en" } },
          cards: [{ id: item.id, source: { text: item.de }, target: { text: item.en } }] };
        const run = await service.start(`teacher:synthetic-${item.id}`, "sets/generation-evaluation.json", document, item.direction, 1, item.level);
        record = { ...item, generated: run.prompt.prefix + run.prompt.focus + run.prompt.suffix, focus: run.prompt.focus, runId: run.id, durationMs: Date.now() - started };
      } catch (_) { record = { ...item, error: "GENERATION_UNAVAILABLE", durationMs: Date.now() - started }; }
      records.push(record);
      fs.writeFileSync(output, JSON.stringify({ model: service.model, records, metrics }, null, 2));
      console.log(JSON.stringify(record));
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  console.log(JSON.stringify({ summary: true, generated: records.filter(r => !r.error).length, unavailable: records.filter(r => r.error).map(r => r.id), modelRequests: metrics.length }));
  if (records.some(r => r.error)) process.exitCode = 1;
})().catch(() => { console.error("Generation probe failed; see the isolated result file"); process.exitCode = 1; });
