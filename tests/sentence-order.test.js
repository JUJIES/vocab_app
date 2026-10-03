const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { SentenceService } = require('../lib/sentence-service');
const { SentenceOrderStore } = require('../lib/sentence-order-store');
const document = { set: { title: 'Order', languages: { source: 'de', target: 'en' } }, cards: ['Apfel','Birne','Banane','Orange'].map((word, i) => ({ id: String(i), source: { text: word }, target: { text: ['apple','pear','banana','orange'][i] } })) };
function service(orderStore) {
  let clock=Date.now();
  const s = new SentenceService({ now:()=>clock, orderStore, client: { responses: { create: async body => {
    const data = JSON.parse(body.input[0].content);
    const result = body.text.format.name === 'sentence_prompt' ? { prefix: 'Ich kaufe ', focus: data.source_expression, suffix: '.' }
      : { grammar: true, meaning: true, target: true, spelling: true, hint: 'Gut gemacht!', problem: null, help: null };
    return { status: 'completed', output_text: JSON.stringify(result) };
  } } } });
  s.advanceMinute=()=>{clock+=60001;};
  return s;
}
test('short runs cover the set before repeats, persist across restart, and ignore difficulty changes', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sentence-order-'));
  try {
    let s = service(new SentenceOrderStore({ dataDir }));
    const seen = [];
    for (let i = 0; i < 8; i++) {
      if (i === 2) s = service(new SentenceOrderStore({ dataDir }));
      s.advanceMinute();
      const run = await s.start('tablet:a', 'sets/a.json', document, 'source-target', 1, i % 2 ? 'hard' : 'easy');
      await s.shown("tablet:a",run.id,"sets/a.json",run.prompt.id);
      seen.push(run.prompt.focus);
    }
    assert.equal(new Set(seen.slice(0,4)).size,4);
    assert.equal(new Set(seen.slice(4)).size,4);
    assert.notEqual(seen[3],seen[4]);
    const persisted = await fs.readFile(path.join(dataDir,'sentence-order.json'),'utf8');
    assert.equal(persisted.includes('Ich kaufe'),false);
    assert.equal(persisted.includes('apple'),false);
  } finally { await fs.rm(dataDir,{recursive:true,force:true}); }
});
test('only shown cards consume coverage; abandoned future cards and failed generation are retained', async () => {
  const orders = new SentenceOrderStore();
  const s = service(orders);
  const run = await s.start('a','sets/a.json',document,'source-target',4);
  await s.shown('a',run.id,'sets/a.json',run.prompt.id);
  const seen = [run.prompt.focus];
  const original = s.generate.bind(s);
  s.generate = async () => { throw Object.assign(new Error('unavailable'),{status:503}); };
  await assert.rejects(s.start('a','sets/a.json',document,'source-target',1));
  assert.equal(s.get('a',run.id,'sets/a.json').prompt.focus,run.prompt.focus);
  s.generate = original;
  for (let i=0;i<3;i++) { s.advanceMinute(); const next=await s.start('a','sets/a.json',document,'source-target',1); await s.shown('a',next.id,'sets/a.json',next.prompt.id); seen.push(next.prompt.focus); }
  assert.equal(new Set(seen).size,4);
  assert.throws(()=>s.get('a',run.id,'sets/a.json'),error=>error.status===410);
});
test('cross-cycle run has no duplicates; failed next is retryable without skipping the pending card', async () => {
  const s=service(new SentenceOrderStore());
  for(let i=0;i<3;i++) { s.advanceMinute(); const next=await s.start('a','sets/a.json',document,'source-target',1); await s.shown('a',next.id,'sets/a.json',next.prompt.id); }
  s.advanceMinute();
  let run=await s.start('a','sets/a.json',document,'source-target',4);
  const seen=[];
  const generate=s.generate.bind(s); let failOnce=true;
  s.generate=async(...args)=>{ if(failOnce){failOnce=false;throw Error('timeout');}return generate(...args);};
  for(let i=0;i<4;i++) {
    seen.push(run.prompt.focus);
    await s.check('a',run.id,'sets/a.json',run.prompt.id,'A correct answer.');
    if(i===0) await assert.rejects(s.next('a',run.id,'sets/a.json',run.prompt.id));
    run=await s.next('a',run.id,'sets/a.json',run.prompt.id);
  }
  assert.equal(run.complete,true);assert.equal(new Set(seen).size,4);
});
test('new/deleted/edited cards reconcile coverage without resetting unchanged seen cards', async () => {
  const orders=new SentenceOrderStore();
  let first=await orders.prepare('a','set','forward',['a','b','c']);await orders.commit(first);
  const newKeys=['a','b','c','d'].filter(key=>key!==first.selected);
  const second=await orders.prepare('a','set','forward',newKeys);await orders.commit(second);
  const third=await orders.prepare('a','set','forward',newKeys);await orders.commit(third);
  const fourth=await orders.prepare('a','set','forward',newKeys);await orders.commit(fourth);
  assert.equal(new Set([second.selected,third.selected,fourth.selected]).size,3);
});
test('directions and actors are independent; reset removes pending runs and selection metadata', async () => {
  const orders=new SentenceOrderStore();const s=service(orders);
  const a=await s.start('a','sets/a.json',document,'source-target',1);
  const reverse=await s.start('a','sets/a.json',document,'target-source',1);
  const b=await s.start('b','sets/a.json',document,'source-target',1);
  assert.equal(s.get('a',a.id,'sets/a.json').id,a.id);
  await s.clear('a','sets/a.json');
  assert.throws(()=>s.get('a',a.id,'sets/a.json'));
  assert.throws(()=>s.get('a',reverse.id,'sets/a.json'));
  assert.equal(s.get('b',b.id,'sets/a.json').id,b.id);
  assert.equal(Object.values(orders.memory.entries).some(entry=>entry.actor==='a'),false);
});

test('preparation alone does not consume cards; display acknowledgement is idempotent', async () => {
  const orders=new SentenceOrderStore(); const s=service(orders);
  const run=await s.start('a','sets/a.json',document,'source-target',1);
  assert.equal(run.shown,false);
  assert.equal(Object.keys(orders.memory.entries).length,0);
  const shown=await s.shown('a',run.id,'sets/a.json',run.prompt.id);
  assert.equal(shown.shown,true);
  const remaining=Object.values(orders.memory.entries)[0].remaining;
  assert.equal(remaining.length,3);
  await s.shown('a',run.id,'sets/a.json',run.prompt.id);
  assert.deepEqual(Object.values(orders.memory.entries)[0].remaining,remaining);
  await assert.rejects(s.shown('a',run.id,'sets/a.json','stale'),error=>error.status===409);
});
test('reset during provider generation cancels the pending run without consuming its card', async () => {
  const orders=new SentenceOrderStore();const s=service(orders);
  let resolve;let started;
  const ready=new Promise(done=>{started=done;});
  s.generate=()=>{started();return new Promise(done=>{resolve=done;});};
  const pending=s.start('a','sets/a.json',document,'source-target',1);
  await ready;
  await s.clear('a');
  resolve({id:'p',prefix:'',focus:'Apfel',suffix:''});
  await assert.rejects(pending,error=>error.status===410);
  assert.equal(Object.keys(orders.memory.entries).length,0);
});
