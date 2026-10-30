// Explicit paid, isolated set evaluation. Not a production route or npm verify.
// Uses an exported vocabulary snapshot; no credentials, sessions or pupil data.
// Retains real generated runs in memory while the evaluator authors answers.json.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const { SentenceService } = require('../lib/sentence-service');
const { SentenceLogStore } = require('../lib/sentence-log-store');
const { SentenceOrderStore } = require('../lib/sentence-order-store');
const context = new AsyncLocalStorage();
const option = name => { const i=process.argv.indexOf(name); return i<0 ? null : process.argv[i+1]; };
const root = path.resolve(option('--output-dir') || 'output/translation-set-evaluation');
const snapshotPath = option('--snapshot');
if (!snapshotPath) throw Error('Usage: node scripts/eval-translation-set.cjs --snapshot <set.json> --output-dir <fresh-directory>');
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const selectedIds = option('--ids')?.split(',');
const levels = option('--levels')?.split(',') || ['easy','medium','hard'];
if (!levels.length || new Set(levels).size!==levels.length || levels.some(level=>!['easy','medium','hard'].includes(level))) throw Error('Use distinct easy,medium,hard levels.');
const cards = snapshot.cards.filter(c=>c.front?.trim() && c.back?.trim() && (!selectedIds || selectedIds.includes(c.id)));
if (!cards.length || selectedIds?.some(id=>!cards.some(c=>c.id===id))) throw Error('Select at least one complete existing vocabulary card.');
if (snapshot.sideSelection?.front !== 'en' || snapshot.sideSelection?.back !== 'de') throw Error('This probe expects English front / German back.');
fs.mkdirSync(root, { recursive:true });
if(fs.existsSync(path.join(root,'manifest.json'))) throw Error('Use a fresh output directory; existing observations must not be overwritten.');
const write = (name,data)=>fs.writeFileSync(path.join(root,name),JSON.stringify(data,null,2));
(async()=>{
 const logStore = new SentenceLogStore({dataDir:path.join(root,'isolated-data')}); await logStore.initialize();
 const service = new SentenceService({logStore,orderStore:new SentenceOrderStore({dataDir:path.join(root,'isolated-data')})});
 if(!service.client)throw Error('Server-side API access required.');
 const manifest={title:snapshot.title,setRevision:snapshot.revision,setUpdatedAt:snapshot.updatedAt,createdAt:new Date().toISOString(),model:service.model,codeCommit:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),cards:cards.length,tasks:cards.length*levels.length,levels,direction:'de-en',synthetic:true,phase:'generation',promptHashes:{}};
 for(const file of ['lib/sentence-service.js','lib/sentence-generation-prompt.js','lib/sentence-feedback-prompt.js'])manifest.promptHashes[file]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 write('manifest.json',manifest);
 const provider = service.client.responses.create.bind(service.client.responses);
 service.client.responses.create=async body=>{
  const at=Date.now();
  try{
   const r=await provider(body);
   fs.appendFileSync(path.join(root,'provider-trace.jsonl'),JSON.stringify({caseId:context.getStore(),kind:body.text.format.name,model:body.model,reasoning:body.reasoning,maxOutputTokens:body.max_output_tokens,input:body.input,repair:body.instructions.includes('REPAIR'),output:r.output_text,status:r.status,incomplete:r.incomplete_details,durationMs:Date.now()-at,usage:r.usage})+'\n');
   return r;
  }catch(e){fs.appendFileSync(path.join(root,'provider-trace.jsonl'),JSON.stringify({caseId:context.getStore(),kind:body.text.format.name,errorName:e.name,status:e.status,durationMs:Date.now()-at})+'\n');throw e;}
 };
 const records=[],queue=cards.flatMap((card,i)=>levels.map(level=>({caseId:`v${String(i+1).padStart(2,'0')}-${level}`,card,level})));const runByCase=new Map();
 async function generate(){while(queue.length){const item=queue.shift();await context.run(item.caseId,async()=>{
  const actor=`teacher:synthetic-ben-${item.caseId}`,setPath='sets/synthetic-ben-snapshot.json';
  const r={caseId:item.caseId,cardId:item.card.id,en:item.card.front,de:item.card.back,level:item.level};records.push(r);
  try{
   const document={set:{title:snapshot.title,languages:{source:'en',target:'de'}},cards:[{id:item.card.id,source:{text:item.card.front},target:{text:item.card.back},acceptedAnswers:item.card.acceptedAnswers||[]}]};
   const run=await service.start(actor,setPath,document,'target-source',1,item.level);
   r.source=run.prompt.prefix+run.prompt.focus+run.prompt.suffix;r.focus=run.prompt.focus;r.runId=run.id;
   runByCase.set(item.caseId,{actor,setPath,runId:run.id,promptId:run.prompt.id});
  }catch(e){r.generationError={message:e.message,status:e.status};}
  write('generated.json',records);console.log(JSON.stringify({phase:'generation',caseId:r.caseId,ok:!r.generationError,count:records.filter(x=>x.source||x.generationError).length}));
 });}}
 await Promise.all(Array.from({length:6},()=>generate()));
 manifest.phase='awaiting-answers';write('manifest.json',manifest);console.log('GENERATION_COMPLETE: waiting for answers.json');
 const answerPath=path.join(root,'answers.json'),deadline=Date.now()+3600000;
 while(!fs.existsSync(answerPath)){if(Date.now()>deadline)throw Error('Timed out waiting for synthetic answers.json; generated data preserved.');await new Promise(r=>setTimeout(r,1000));}
 const answers=JSON.parse(fs.readFileSync(answerPath,'utf8'));const ids=new Set(records.filter(r=>r.source).map(r=>r.caseId));
 if(Object.keys(answers).some(id=>!ids.has(id)) || [...ids].some(id=>!Array.isArray(answers[id]?.attempts)||!answers[id].attempts.length))throw Error('Answers must cover exactly all successfully generated cases.');
 manifest.phase='feedback';write('manifest.json',manifest);const pending=records.filter(r=>r.source);
 async function check(){while(pending.length){const r=pending.shift();await context.run(r.caseId,async()=>{
  const identity=runByCase.get(r.caseId);r.answerPlan=answers[r.caseId];r.attempts=[];
  for(const planned of r.answerPlan.attempts){
   if(r.attempts.at(-1)?.accepted)break;
   try{const result=await service.check(identity.actor,identity.runId,identity.setPath,identity.promptId,planned.answer);r.attempts.push({kind:planned.kind,answer:planned.answer,expectedAccepted:planned.expectedAccepted,accepted:result.accepted,status:result.status,feedback:result.feedback,issues:result.issues,help:result.help,history:result.history});}
   catch(e){r.attempts.push({kind:planned.kind,answer:planned.answer,expectedAccepted:planned.expectedAccepted,error:{message:e.message,status:e.status}});}
   write('results.json',records);
  }
  r.solved=Boolean(r.attempts.at(-1)?.accepted);
  if(r.solved){const done=await service.next(identity.actor,identity.runId,identity.setPath,identity.promptId);r.complete=done.complete;}
  write('results.json',records);console.log(JSON.stringify({phase:'feedback',caseId:r.caseId,solved:r.solved,attempts:r.attempts.length}));
 });}}
 await Promise.all(Array.from({length:6},()=>check()));manifest.phase='complete';manifest.completedAt=new Date().toISOString();write('manifest.json',manifest);write('results.json',records);
 console.log(JSON.stringify({complete:true,tasks:records.length,generated:records.filter(r=>r.source).length,solved:records.filter(r=>r.solved).length}));
 if(records.some(r=>r.generationError || !r.complete || r.attempts.some(a=>a.accepted!==a.expectedAccepted)))process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
