const {test,expect}=require('./teacher-release-fixture.cjs');
const path=require('node:path');
const origin=process.env.BASE_URL||'http://127.0.0.1:4030';
test.use({viewport:{width:1400,height:1000},serviceWorkers:'block',locale:'de-DE'});
for(const theme of ['light','dark'])test(`Room shows feedback and a literal editing cursor (${theme})`,async({page},info)=>{
 await page.addInitScript(theme=>localStorage.setItem('lerndeck-teacher-appearance-v1',JSON.stringify({mode:theme})),theme);
 const set={id:'room-probe',path:'sets/user/room-probe.json',title:'Room probe',status:'published',sourceLanguage:'de',targetLanguage:'en',sourceLabel:'Deutsch',targetLabel:'Englisch',learningCardCount:1,cards:[]};
 const run={id:'probe-run',total:1,position:1,difficulty:'easy',targetLanguage:'en',prompt:{id:'prompt',prefix:'Das ',focus:'Auto',suffix:' ist blau.'},shown:true,accepted:false,history:[]};
 await page.route('**/api/teacher/session',r=>r.fulfill({json:{session:{teacherId:'julius'},teacher:{id:'julius'}}}));
 await page.route('**/api/teacher/sets/room-probe',r=>r.fulfill({json:{set}}));
 let checks=0;
 await page.route('**/api/sentence-practice/*',r=>{
  if(r.request().url().endsWith('/check')){checks++;const answer=r.request().postDataJSON().answer;run.history.push({id:'attempt-'+checks,answer,status:'revise',feedback:'Die Vokabel passt. Prüfe die Verbform.',issues:[],help:null});run.feedback=run.history.at(-1).feedback;run.checkedAnswer=answer;run.status='revise';}
  return r.fulfill({json:{run}});
 });
 await page.route(origin+'/room-probe',r=>r.fulfill({contentType:'text/html',body:`<iframe id="provider" style="width:600px;height:700px" src="/?teacherPractice=room-probe&embed=tafelraum"></iframe><div id="replica" style="width:600px;height:700px"></div>`}));
 await page.goto(origin+'/room-probe');
 const provider=page.frameLocator('#provider');
 await provider.locator('button[data-mode-key="sentence"]').click();await provider.locator('#launch-mode-start').click();await provider.locator('#launch-settings-start').click();
 await expect(provider.locator('#sentence-prompt')).toHaveText('Das Auto ist blau.');
 await page.addScriptTag({path:path.join(path.dirname(require.resolve('rrweb')),'rrweb.umd.min.cjs')});
 await page.evaluate(()=>{
  window.packets=[];window.player=null;let meta;
  window.addEventListener('message',e=>{
   if(e.data?.type!=='tafelraum:app-view')return;
   window.packets.push(e.data);
   for(const event of e.data.events){
    if(event.type===4)meta=event;
    if(event.type===2){window.player?.destroy();document.querySelector('#replica').replaceChildren();window.player=new rrweb.Replayer([],{root:document.querySelector('#replica'),liveMode:true,mouseTail:false,triggerFocus:false,showWarning:false,insertStyleRules:['html{pointer-events:none!important}']});window.player.startLive(Date.now()-120);window.player.addEvent(meta);}
    window.player?.addEvent(event);
   }
  });
  document.querySelector('#provider').contentWindow.postMessage({type:'tafelraum:app-view-mode',protocol:'rrweb-2.2-v1',appId:'lerndeck',token:'12345678-1234-1234-1234-123456789012',enabled:true},location.origin);
 });
 const replay=page.frameLocator('#replica iframe');
 await expect(replay.locator('#sentence-answer')).toBeVisible();
 await provider.locator('#sentence-answer').fill('The car are blue.');await provider.locator('#sentence-answer').press('ArrowLeft');
 await expect(replay.locator('[data-room-caret]')).toBeVisible();
 const first=await replay.locator('[data-room-caret]').boundingBox();
 await provider.locator('#sentence-answer').press('ArrowLeft');
 await expect.poll(async()=> (await replay.locator('[data-room-caret]').boundingBox())?.x).toBeLessThan(first.x);
 await provider.locator('#sentence-answer').fill('A long answer with several words that wraps onto another line. '.repeat(5));
 await expect.poll(()=>provider.locator('#sentence-answer').evaluate(n=>n.scrollHeight>n.clientHeight)).toBe(true);
 await expect.poll(()=>replay.locator('[data-room-caret]').evaluate(n=>n.style.top)).toBe(await provider.locator('[data-room-caret]').evaluate(n=>n.style.top));
 await provider.locator('#sentence-answer').fill('The car are blue.');
 await provider.locator('#sentence-submit').hover();
 await expect(replay.locator('[data-room-pointer]')).toHaveCount(0);
 expect(await replay.locator('[data-room-caret]').evaluate(n=>getComputedStyle(n).width)).toBe('1px');
 expect(await replay.locator('[data-room-caret]').evaluate(n=>getComputedStyle(n).boxShadow)).toBe('none');
 await expect.poll(()=>replay.locator('[data-room-caret]').evaluate(n=>n.style.opacity)).toBe('0');
 await expect.poll(()=>replay.locator('[data-room-caret]').evaluate(n=>n.style.opacity)).toBe('1');
 await page.locator('#replica').screenshot({path:info.outputPath(`room-input-${theme}.png`)});
 await provider.locator('#sentence-submit').click();
 await expect(provider.locator('.sentence-stage__feedback-entry--new')).toHaveCount(0);
 await expect(replay.locator('.sentence-stage__feedback-entry')).toContainText('Prüfe die Verbform.');
 await expect.poll(()=>replay.locator('.sentence-stage__feedback-entry').evaluate(n=>getComputedStyle(n).opacity)).toBe('1');
 await expect.poll(()=>replay.locator('html').evaluate(()=>document.scrollingElement.scrollTop)).toBe(await provider.locator('html').evaluate(()=>document.scrollingElement.scrollTop));
 // Verify actual visibility in a paused, scriptless replica, not just copied text.
 expect(await replay.locator('html').evaluate(n=>n.classList.contains('rrweb-paused'))).toBe(true);
 expect(await replay.locator('html').evaluate(()=>window.frameElement.getAttribute('sandbox'))).not.toContain('allow-scripts');
 await page.locator('#replica').screenshot({path:info.outputPath(`room-feedback-${theme}.png`)});
 await provider.locator('body').evaluate(body=>{const input=document.createElement('input');input.type='password';input.id='secret-probe';body.append(input);});
 await provider.locator('#secret-probe').fill('SECRET_ROOM_3928');await provider.locator('#secret-probe').hover();
 await expect(provider.locator('[data-room-pointer]')).toHaveCount(0);await expect(provider.locator('[data-room-caret]')).toBeHidden();
 expect(await page.evaluate(()=>JSON.stringify(window.packets).includes('SECRET_ROOM_3928'))).toBe(false);
 expect(checks).toBe(1);
 await provider.locator('#sentence-answer').click();
 await expect.poll(()=>provider.locator('#sentence-answer').evaluate(n=>n.style.caretColor)).toBe('transparent');
 await page.evaluate(()=>document.querySelector('#provider').contentWindow.postMessage({type:'tafelraum:app-view-mode',protocol:'rrweb-2.2-v1',appId:'lerndeck',token:'12345678-1234-1234-1234-123456789012',enabled:false},location.origin));
 await expect(provider.locator('[data-room-pointer],[data-room-caret],[data-room-measure]')).toHaveCount(0);
 expect(await provider.locator('#sentence-answer').evaluate(n=>n.style.caretColor)).toBe('');
});
