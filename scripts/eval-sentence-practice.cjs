// Explicit paid evaluation, never part of npm verify. Synthetic cases only.
// Service module can be injected to evaluate an uncommitted candidate remotely.
const fs = require('node:fs');
const { SentenceService } = require(process.env.SENTENCE_SERVICE_MODULE || '../lib/sentence-service');
const cases = require('./sentence-eval-cases.json');
const selected = process.env.SENTENCE_EVAL_IDS ? cases.filter(item => process.env.SENTENCE_EVAL_IDS.split(',').includes(item.id)) : cases;
if (process.env.SENTENCE_EVAL_IDS) {
  const missing = process.env.SENTENCE_EVAL_IDS.split(',').filter(id => !cases.some(item => item.id === id));
  if (missing.length) throw new Error('Unknown evaluation cases: ' + missing.join(', '));
}
for (const item of selected) {
  if (!item.source.includes(item.focus)) throw new Error('Fixture focus missing: ' + item.id);
}
(async () => {
  const service = new SentenceService();
  const records = [];
  const traces = [];
  if (!service.client) throw new Error("Für den kostenpflichtigen Modelltest fehlt ein konfigurierter API-Key.");
  const providerFailures = [];
  const providerMetrics = [];
  const create = service.client.responses.create.bind(service.client.responses);
  service.client.responses.create = async body => {
    const data = JSON.parse(body.input[0].content);
    const started = Date.now();
    try {
      const response = await create(body);
      providerMetrics.push({ key: data.learner_answer || data.source_expression, kind: body.text.format.name, durationMs: Date.now() - started, outputTokens: response.usage?.output_tokens, reasoningTokens: response.usage?.output_tokens_details?.reasoning_tokens });
      if (response.status !== 'completed') providerFailures.push({ key: data.learner_answer || data.source_expression, status: response.status, reason: response.incomplete_details?.reason });
      return response;
    } catch (error) {
      // Names/status only, never provider messages, headers or credentials.
      providerFailures.push({ key: data.learner_answer || data.source_expression, name: error.name, status: error.status });
      throw error;
    }
  };
  const originalAsk = service.ask.bind(service);
  service.ask = async (name, format, instructions, data) => {
    const result = await originalAsk(name, format, instructions, data);
    traces.push({ name, repair: instructions.split("REPAIR REQUIRED: ")[1] || "", key: data.learner_answer || data.source_expression, difficulty: data.difficulty, result });
    return result;
  };
  await Promise.all(['easy', 'medium', 'hard'].map(async level => {
    for (const item of selected.filter(item => item.level === level)) {
      const actor = 'evaluation:' + item.id;
      const sourceLanguage = item.reverse ? 'en' : 'de';
      const targetLanguage = item.reverse ? 'de' : 'en';
      const document = { set: { title: 'Synthetic evaluation', languages: { source: sourceLanguage, target: targetLanguage } }, cards: [{ source: { text: item.focus }, target: { text: item.target }, acceptedAnswers: item.variants || [] }] };
      try {
        const run = await service.start(actor, 'sets/evaluation.json', document, 'source-target', 1, level);
        const generated = run.prompt.prefix + run.prompt.focus + run.prompt.suffix;
        // Hold the checked task constant across prompt versions; separately retain
        // the real generated sentence for difficulty/idiom review.
        const internal = service.get(actor, run.id, 'sets/evaluation.json');
        const focusAt = item.source.indexOf(item.focus);
        if (focusAt < 0) throw Error('Fixture focus missing');
        internal.prompt = { id: run.prompt.id, prefix: item.source.slice(0, focusAt), focus: item.focus, suffix: item.source.slice(focusAt + item.focus.length) };
        const first = await service.check(actor, run.id, 'sets/evaluation.json', run.prompt.id, item.answer);
        const revisions = [];
        for (const revision of item.revisions || []) {
          // Keep false positives visible while still evaluating the next control.
          internal.accepted = false; internal.lastAnswer = '';
          const result = await service.check(actor, run.id, 'sets/evaluation.json', run.prompt.id, revision.answer);
          revisions.push({ ...revision, result });
        }
        let corrected = first;
        if (item.answer !== item.correct) {
          // A false positive is a reported failure. Reset the isolated fixture so
          // that the correct control answer is still genuinely checked by the API.
          internal.accepted = false; internal.lastAnswer = '';
          corrected = await service.check(actor, run.id, 'sets/evaluation.json', run.prompt.id, item.correct);
        }
        let complete = false;
        if (corrected.accepted) complete = (await service.next(actor, run.id, 'sets/evaluation.json', run.prompt.id)).complete;
        const marksMatch = (fixture, result) => {
          const marked = (result.issues || []).filter(issue => issue.problem).map(issue => fixture.answer.trim().slice(issue.problem.start, issue.problem.end));
          return (!fixture.expectedMarked || fixture.expectedMarked.every(word => marked.some(quote => quote.split(/\s+/).includes(word)))) && (!fixture.expectNoMarks || !marked.length);
        };
        const markingPass = marksMatch(item, first) && revisions.every(revision => marksMatch(revision, revision.result));
        const record = { ...item, generated, providerMetrics: providerMetrics.filter(metric => [item.focus, item.answer, item.correct, ...(item.revisions || []).map(revision => revision.answer)].includes(metric.key)), markingPass, first, revisions, corrected, complete, pass: markingPass && first.accepted === item.expected && revisions.every(revision => revision.result.accepted === revision.expected) && corrected.accepted && complete && [first, ...revisions.map(revision => revision.result), corrected].every(result => /\p{Extended_Pictographic}/u.test(result.feedback)) };
        records.push(record);
        console.log(JSON.stringify(record));
      } catch (error) { const record = { ...item, pass: false, error: error.message, providerFailures: providerFailures.filter(failure => [item.focus, item.answer, item.correct].includes(failure.key)), trace: traces.filter(trace => trace.difficulty === item.level && [item.focus, item.answer, item.correct].includes(trace.key)) }; records.push(record); console.log(JSON.stringify(record)); }
    }
  }));
  const outputAt = process.argv.indexOf('--output');
  if (outputAt >= 0) fs.writeFileSync(process.argv[outputAt + 1], JSON.stringify(records, null, 2));
  console.log(JSON.stringify({ summary: true, cases: records.length, passed: records.filter(item => item.pass).length, failed: records.filter(item => !item.pass).map(item => item.id), model: service.model, latencyMs: providerMetrics.length ? { mean: Math.round(providerMetrics.reduce((sum, metric) => sum + metric.durationMs, 0) / providerMetrics.length), max: Math.max(...providerMetrics.map(metric => metric.durationMs)) } : null }));
  if (records.some(item => !item.pass)) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
