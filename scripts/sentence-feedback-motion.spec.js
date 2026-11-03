const {test,expect}=require('./teacher-release-fixture.cjs');
test.use({baseURL:process.env.BASE_URL||'http://127.0.0.1:4030',viewport:{width:1280,height:850},locale:'de-DE',serviceWorkers:'block'});
for(const theme of ['light','dark'])test(`Translation feedback is composed, animated once and motion-safe (${theme})`,async({page},info)=>{
 await page.addInitScript(theme=>localStorage.setItem('lerndeck-teacher-appearance-v1',JSON.stringify({mode:theme})),theme);
 const set={id:'motion',path:'sets/user/motion.json',title:'Translation',status:'published',sourceLanguage:'de',targetLanguage:'en',sourceLabel:'Deutsch',targetLabel:'Englisch',learningCardCount:1,cards:[]};
 let run={id:'run',total:1,position:1,difficulty:'easy',targetLanguage:'en',prompt:{id:'one',prefix:'Sie ',focus:'hat',suffix:' einen Hund.'},accepted:false,shown:true,history:[]},release;
 await page.route('**/api/teacher/session',r=>r.fulfill({json:{session:{teacherId:'julius'},teacher:{id:'julius'}}}));
 await page.route('**/api/teacher/sets/motion',r=>r.fulfill({json:{set}}));
 await page.route('**/api/sentence-practice/*',async r=>{
  if(r.request().url().endsWith('/check')){
   const answer=r.request().postDataJSON().answer,accepted=answer==='She has a dog.';
   if(!accepted)await new Promise(resolve=>{release=resolve;});
   const feedback=accepted?'Die Verbform passt jetzt. Gut überarbeitet 👍':'Die Bedeutung passt. Prüfe noch die Verbform 🔎';
   run={...run,accepted,status:accepted?'accepted':'revise',feedback,checkedAnswer:answer,history:[...run.history,{id:accepted?'correct':'revise',answer,status:accepted?'accepted':'revise',feedback,issues:[],help:null}]};
  }
  return r.fulfill({json:{run}});
 });
 await page.goto('/?teacherPractice=motion');
 await page.locator('button[data-mode-key="sentence"]').click();await page.locator('#launch-mode-start').click();await page.locator('#launch-settings-start').click();
 const answer=page.locator('#sentence-answer'),button=page.locator('#sentence-submit');
 await answer.fill('She have a dog.');await answer.press('Enter');
 await expect(button).toHaveAttribute('data-pending','true');await expect(page.locator('#sentence-form')).toHaveAttribute('aria-busy','true');
 await expect.poll(()=>button.evaluate(n=>getComputedStyle(n,'::after').transform)).not.toBe('none');
 const scan=await button.evaluate(n=>getComputedStyle(n,'::after').transform);
 await expect.poll(()=>button.evaluate(n=>getComputedStyle(n,'::after').transform)).not.toBe(scan);
 await expect.poll(()=>typeof release).toBe('function');
 await page.locator('#sentence-stage .input-stage__card').screenshot({path:info.outputPath(`checking-${theme}.png`)});
 release();
 const active=page.locator('.sentence-stage__feedback-entry:not([hidden])');
 await expect(active.locator('.sentence-stage__feedback-result')).toHaveText('Überarbeiten');
 await expect(active).toHaveClass(/feedback-entry--new/);
 expect(await active.evaluate(n=>getComputedStyle(n).opacity)).toBe('1');
 await expect(active).not.toHaveClass(/feedback-entry--new/);
 expect(await active.locator('path').evaluate(n=>parseFloat(getComputedStyle(n).strokeDashoffset))).toBe(0);
 for(const width of [1280,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await active.screenshot({path:info.outputPath(`revise-${theme}-${width}.png`)});}
 await answer.fill('She has a dog.');await answer.press('Enter');
 await expect(active.locator('.sentence-stage__feedback-result')).toHaveText('Passt');
 await expect(active).not.toHaveClass(/feedback-entry--new/);
 await active.screenshot({path:info.outputPath(`accepted-${theme}-390.png`)});
 await expect(answer).toBeFocused();await expect(button).toHaveAttribute('data-pending','false');
 await page.reload();await expect(active.locator('.sentence-stage__feedback-result')).toHaveText('Passt');await expect(active).not.toHaveClass(/feedback-entry--new/);
 // A fresh attempt with reduced motion has the same visible outcome immediately.
 await page.emulateMedia({reducedMotion:'reduce'});
 run={...run,accepted:false,history:[],feedback:'',checkedAnswer:'',status:'ready'};
 await page.reload();await answer.fill('She has a dog.');await answer.press('Enter');
 await expect(active.locator('.sentence-stage__feedback-result')).toHaveText('Passt');
 expect(await active.evaluate(n=>n.getAnimations({subtree:true}).filter(a=>a.playState==='running').length)).toBe(0);
 expect(await active.locator('path').evaluate(n=>parseFloat(getComputedStyle(n).strokeDashoffset))).toBe(0);
});
