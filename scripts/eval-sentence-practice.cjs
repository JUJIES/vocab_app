// Explicit paid evaluation, never part of npm verify. Synthetic cases only.
// Service module can be injected to evaluate an uncommitted candidate remotely.
const fs = require('node:fs');
const { SentenceService } = require(process.env.SENTENCE_SERVICE_MODULE || '../lib/sentence-service');
const cases = require('./sentence-eval-cases.json');
const selected = process.env.SENTENCE_EVAL_IDS ? cases.filter(item => process.env.SENTENCE_EVAL_IDS.split(',').includes(item.id)) : cases;
for (const item of selected) {
  if (!item.source.includes(item.focus)) throw new Error('Fixture focus missing: ' + item.id);
}
(async () => {
  const service = new SentenceService();
  const records = [];
  const traces = [];
  const originalAsk = service.ask.bind(service);
  service.ask = async (name, format, instructions, data) => {
    const result = await originalAsk(name, format, instructions, data);
    traces.push({ name, key: data.learner_answer || data.source_expression, difficulty: data.difficulty, result });
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
        const record = { ...item, generated, first, revisions, corrected, complete, pass: first.accepted === item.expected && revisions.every(revision => revision.result.accepted === revision.expected) && corrected.accepted && complete && [first, ...revisions.map(revision => revision.result), corrected].every(result => /\p{Extended_Pictographic}/u.test(result.feedback)) };
        records.push(record);
        console.log(JSON.stringify(record));
      } catch (error) { const record = { ...item, pass: false, error: error.message, trace: traces.filter(trace => trace.difficulty === item.level && [item.focus, item.answer, item.correct].includes(trace.key)) }; records.push(record); console.log(JSON.stringify(record)); }
    }
  }));
  const outputAt = process.argv.indexOf('--output');
  if (outputAt >= 0) fs.writeFileSync(process.argv[outputAt + 1], JSON.stringify(records, null, 2));
  console.log(JSON.stringify({ summary: true, cases: records.length, passed: records.filter(item => item.pass).length, failed: records.filter(item => !item.pass).map(item => item.id), model: service.model }));
  if (records.some(item => !item.pass)) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
