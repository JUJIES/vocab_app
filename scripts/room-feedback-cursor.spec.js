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
 // Use a real contenteditable DOM Range as the browser's shaping reference,
 // independent of the textarea's hidden measurement box. Trailing AV and
 // in-word positions expose the former split-span/kerning displacement.
 await provider.locator('#sentence-answer').evaluate(n=>{n.style.font='32px Georgia, serif';n.style.fontKerning='normal';n.style.fontFeatureSettings='"kern"';});
 for(const scale of [1,1.25]) for(const [value,offset] of [['AV',2],['AVATAR',3],['office affinity',4]]) {
  await provider.locator('#sentence-answer').evaluate((n,scale)=>{n.style.transform=`scale(${scale})`;n.style.transformOrigin='top left';},scale);
  await provider.locator('#sentence-answer').fill(value);
  await provider.locator('#sentence-answer').evaluate((n,offset)=>n.setSelectionRange(offset,offset),offset);
  const expected=await provider.locator('#sentence-answer').evaluate((n,offset)=>{
   const css=getComputedStyle(n),ref=document.createElement('div');
   ref.contentEditable='true';ref.style.cssText='all:initial;position:fixed;left:0;top:0;visibility:hidden;white-space:pre';
   ref.style.font='32px Georgia, serif';ref.style.fontKerning=css.fontKerning;ref.style.fontFeatureSettings=css.fontFeatureSettings;ref.style.textRendering=css.textRendering;
   const text=document.createTextNode(n.value);ref.append(text);document.body.append(ref);
   const range=document.createRange();range.setStart(text,offset);range.collapse(true);
   const at=range.getBoundingClientRect(),box=ref.getBoundingClientRect(),field=n.getBoundingClientRect();
   const sx=field.width/n.offsetWidth,sy=field.height/n.offsetHeight;
   const result={x:field.left+(parseFloat(css.borderLeftWidth)+parseFloat(css.paddingLeft)+at.left-box.left)*sx,y:field.top+(parseFloat(css.borderTopWidth)+parseFloat(css.paddingTop)+at.top-box.top)*sy,height:at.height*sy};ref.remove();return result;
  },offset);
  // WebKit's end-of-run Range and inline end box can differ by one
  // layout pixel. Bound that browser rounding before presentation scaling.
  await expect.poll(()=>provider.locator('[data-room-caret]').evaluate((n,x)=>Math.abs(parseFloat(n.style.left)-x),expected.x)).toBeLessThan(scale);
  await expect.poll(()=>replay.locator('[data-room-caret]').evaluate((n,x)=>Math.abs(parseFloat(n.style.left)-x),expected.x)).toBeLessThan(scale);
  await expect.poll(()=>replay.locator('[data-room-caret]').evaluate((n,y)=>Math.abs(parseFloat(n.style.top)-y),expected.y)).toBeLessThan(scale);
  await expect.poll(()=>replay.locator('[data-room-caret]').evaluate((n,h)=>Math.abs(parseFloat(n.style.height)-h),expected.height)).toBeLessThan(scale);
 }
 await provider.locator('#sentence-answer').evaluate(n=>{n.style.removeProperty('transform');n.style.removeProperty('transform-origin');n.style.removeProperty('font');n.style.removeProperty('font-kerning');n.style.removeProperty('font-feature-settings');});
 await provider.locator('#sentence-answer').fill('The car are blue.');await provider.locator('#sentence-answer').press('ArrowLeft');
 await expect(replay.locator('[data-room-caret]')).toBeVisible();
 await expect.poll(()=>provider.locator('[data-room-measure]').textContent()).toBe('The car are blue.\u200b');
 const sourceLeft=await provider.locator('#sentence-answer').evaluate(n=>{
  const css=getComputedStyle(n),ref=document.createElement('div');ref.contentEditable='true';
  ref.style.cssText='all:initial;position:fixed;left:0;top:0;visibility:hidden;white-space:pre';
  for(const key of ['fontFamily','fontSize','fontWeight','fontStyle','fontVariant','fontStretch','lineHeight','letterSpacing','fontFeatureSettings','fontVariationSettings','fontKerning','textRendering'])ref.style[key]=css[key];
  const text=document.createTextNode(n.value);ref.append(text);document.body.append(ref);
  const range=document.createRange();range.setStart(text,n.selectionEnd);range.collapse(true);
  const x=n.getBoundingClientRect().left+parseFloat(css.borderLeftWidth)+parseFloat(css.paddingLeft)+range.getBoundingClientRect().left-ref.getBoundingClientRect().left;ref.remove();return x;
 });
 await expect.poll(()=>replay.locator('[data-room-caret]').evaluate((n,x)=>Math.abs(parseFloat(n.style.left)-x),sourceLeft)).toBeLessThan(1);
 const first=await replay.locator('[data-room-caret]').boundingBox();
 await provider.locator('#sentence-answer').press('ArrowLeft');
 await expect.poll(async()=> (await replay.locator('[data-room-caret]').boundingBox())?.x).toBeLessThan(first.x);
 await provider.locator('#sentence-answer').fill('A long answer with several words that wraps onto another line. '.repeat(5));
 await expect.poll(()=>provider.locator('#sentence-answer').evaluate(n=>n.scrollHeight>n.clientHeight)).toBe(true);
 await expect(replay.locator('#sentence-answer')).toHaveValue('A long answer with several words that wraps onto another line. '.repeat(5));
 await expect.poll(async()=>{const source=await provider.locator('[data-room-caret]').evaluate(n=>n.style.top);return (await replay.locator('[data-room-caret]').evaluate(n=>n.style.top))===source;}).toBe(true);
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
