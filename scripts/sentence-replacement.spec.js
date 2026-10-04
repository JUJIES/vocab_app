const {test,expect}=require('playwright/test');
const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:4043';
test.use({baseURL:BASE_URL,viewport:{width:1280,height:900},locale:'de-DE',serviceWorkers:'block'});
for(const mode of ['light','dark']) test(`new sentence preserves draft on failure and resets only the current task (${mode})`,async({page},info)=>{
 await page.addInitScript(mode=>localStorage.setItem('lerndeck-teacher-appearance-v1',JSON.stringify({mode})),mode);
 const set={id:'replacement-fixture',path:'sets/user/replacement-fixture.json',title:'Sentence starters',status:'published',sourceLanguage:'de',targetLanguage:'en',sourceLabel:'Deutsch',targetLabel:'Englisch',learningCardCount:8,cards:[]};
 await page.route('**/api/teacher/session',r=>r.fulfill({json:{session:{teacherId:'julius'},teacher:{id:'julius'}}}));
 await page.route('**/api/teacher/sets/replacement-fixture',r=>r.fulfill({json:{set}}));
 let replacementCalls=0;let run={id:'r',total:1,position:1,difficulty:'easy',targetLanguage:'en',prompt:{id:'p1',prefix:'',focus:'Ein Nachteil ist',suffix:' der hohe Preis.'},accepted:false,history:[],shown:true};
 await page.route('**/api/sentence-practice/*',async route=>{
  const action=route.request().url().split('/').pop();const body=route.request().postDataJSON();
  if(action==='replace'){
   replacementCalls++;expect(body.answer).toBeUndefined();
   if(replacementCalls===1)return route.fulfill({status:503,json:{error:'Neuer Satz konnte nicht vorbereitet werden. Bitte erneut versuchen.'}});
   await new Promise(r=>setTimeout(r,250));
   run={...run,prompt:{id:'p2',prefix:'',focus:'Ein Nachteil ist',suffix:' der lange Weg.'},accepted:false,feedback:'',history:[],checkedAnswer:'',status:'ready'};
  }
  if(action==='check'){
   if(body.answer==='A disadvantage is')run={...run,accepted:false,status:'revise',feedback:'Der Satzanfang passt 👍 Die Fortsetzung fehlt noch.',checkedAnswer:body.answer,history:[{id:'a1',answer:body.answer,status:'revise',feedback:'Der Satzanfang passt 👍 Die Fortsetzung fehlt noch.',issues:[{quote:null,problem:null,message:'Unvollständiger Satz: Übersetze auch die Fortsetzung.'}],help:null}]};
   else run={...run,accepted:true,status:'accepted',feedback:'Jetzt ist die Fortsetzung auch übersetzt 👍',checkedAnswer:body.answer,history:[{id:'a2',answer:body.answer,status:'accepted',feedback:'Jetzt ist die Fortsetzung auch übersetzt 👍',issues:[],help:null}]};
  }
  if(action==='next')run={...run,complete:true};
  return route.fulfill({json:{run}});
 });
 await page.goto('/?teacherPractice=replacement-fixture');await page.locator('[data-mode-key="sentence"].launch-mode-modal__mode-card').click();await page.locator('#launch-mode-start').click();await page.locator('#launch-settings-start').click();
 await expect(page.locator('#sentence-replace')).toBeVisible();
 await page.locator('#sentence-answer').fill('A disadvantage is');await page.locator('#sentence-submit').click();await expect(page.locator('#sentence-feedback')).toContainText('Fortsetzung fehlt');
 await page.locator('#sentence-replace').click();await expect(page.locator('#sentence-feedback-notice')).toContainText('nicht vorbereitet');await expect(page.locator('#sentence-answer')).toHaveValue('A disadvantage is');await expect(page.locator('#sentence-prompt')).toContainText('hohe Preis');await expect(page.locator('#sentence-feedback-list')).toContainText('A disadvantage is');
 await page.locator('#sentence-replace').click();await expect(page.locator('#sentence-replace')).toBeDisabled();await expect(page.locator('#sentence-submit')).toBeDisabled();await expect(page.locator('#sentence-prompt')).toContainText('lange Weg');
 await expect(page.locator('#sentence-answer')).toHaveValue('');await expect(page.locator('#sentence-feedback')).toBeHidden();await expect(page.locator('#sentence-progress')).toHaveText('1 / 1');
 await page.locator('#sentence-answer').fill('A disadvantage is the long journey.');await page.reload();await expect(page.locator('#sentence-answer')).toHaveValue('A disadvantage is the long journey.');await expect(page.locator('#sentence-prompt')).toContainText('lange Weg');
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});await page.locator('#sentence-replace').scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#sentence-stage .input-stage__card').screenshot({path:info.outputPath(`${mode}-${width}.png`)});}
 await page.locator('#sentence-submit').click();await expect(page.locator('#sentence-replace')).toBeHidden();await expect(page.locator('#sentence-submit')).toHaveText('Weiter');await page.locator('#sentence-submit').click();await expect(page.locator('#sentence-prompt')).toHaveText('Geschafft!');expect(replacementCalls).toBe(2);
});
