const {test,expect}=require('./teacher-release-fixture.cjs');
const origin=process.env.BASE_URL||'http://127.0.0.1:4030';
test.use({baseURL:origin,viewport:{width:1280,height:850},serviceWorkers:'block',locale:'de-DE'});
for(const embedded of [false,true])test(`Translation proceeds with Enter and retains editing focus (embedded=${embedded})`,async({page})=>{
 const set={id:'keyboard',path:'sets/user/keyboard.json',title:'Keyboard',status:'published',sourceLanguage:'de',targetLanguage:'en',sourceLabel:'Deutsch',targetLabel:'Englisch',learningCardCount:2,cards:[]};
 let run={id:'run',total:2,position:1,difficulty:'easy',targetLanguage:'en',prompt:{id:'one',prefix:'Das ',focus:'Auto',suffix:' ist blau.'},accepted:false,shown:true,history:[]};
 const actions=[];let release;
 await page.route('**/api/teacher/session',r=>r.fulfill({json:{session:{teacherId:'julius'},teacher:{id:'julius'}}}));
 await page.route('**/api/teacher/sets/keyboard',r=>r.fulfill({json:{set}}));
 await page.route('**/api/sentence-practice/*',async r=>{
  const action=r.request().url().split('/').at(-1);actions.push(action);
  if(action==='check'){
   const answer=r.request().postDataJSON().answer;
   if(answer==='The car are blue.')await new Promise(resolve=>{release=resolve;});
   const accepted=answer==='The car is blue.';
   run={...run,accepted,checkedAnswer:answer,status:accepted?'accepted':'revise',feedback:accepted?'Das passt 👍':'Prüfe die Verbform 🔎',history:[...run.history,{id:String(actions.length),answer,status:accepted?'accepted':'revise',feedback:accepted?'Das passt 👍':'Prüfe die Verbform 🔎',issues:[],help:null}]};
  }
  if(action==='next')run={...run,position:2,prompt:{id:'two',prefix:'Das ',focus:'Fahrrad',suffix:' ist rot.'},accepted:false,checkedAnswer:'',history:[],feedback:'',status:'ready'};
  await r.fulfill({json:{run}});
 });
 if(embedded)await page.route(origin+'/keyboard-parent',r=>r.fulfill({contentType:'text/html',body:'<iframe id=keyboard-provider style="width:1150px;height:800px" src="/?teacherPractice=keyboard&embed=tafelraum"></iframe>'}));
 await page.goto(embedded?'/keyboard-parent':'/?teacherPractice=keyboard');
 const scope=embedded?page.frameLocator('#keyboard-provider'):page;
 await scope.locator('button[data-mode-key="sentence"]').click();await scope.locator('#launch-mode-start').click();await scope.locator('#launch-settings-start').click();
 const answer=scope.locator('#sentence-answer');
 await expect(answer).toBeFocused();
 await answer.press('Enter');expect(actions.filter(x=>x==='check')).toHaveLength(0); // required field validation
 await answer.fill('First');await answer.press('Shift+Enter');await page.keyboard.type('Second');
 await expect(answer).toHaveValue('First\nSecond');expect(actions.filter(x=>x==='check')).toHaveLength(0);
 for(const options of [{repeat:true},{isComposing:true},{keyCode:229}])await answer.dispatchEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...options});
 expect(actions.filter(x=>x==='check')).toHaveLength(0);
 await answer.fill('The car are blue.');await page.keyboard.press('Enter');
 await expect(answer).toBeDisabled();
 await expect.poll(()=>typeof release).toBe('function');
 // A repeat during the request cannot add a second check.
 await page.keyboard.down('Enter');await page.keyboard.up('Enter');
 expect(actions.filter(x=>x==='check')).toHaveLength(1);release();
 await expect(answer).toBeFocused();await expect(scope.locator('#sentence-feedback-list')).toContainText('Prüfe die Verbform');
 await answer.fill('The car is blue.');await page.keyboard.press('Enter');
 await expect(scope.locator('#sentence-submit')).toHaveText('Weiter');await expect(answer).toBeFocused();
 await answer.dispatchEvent('keydown',{key:'Enter',repeat:true,bubbles:true,cancelable:true});
 expect(actions.filter(x=>x==='next')).toHaveLength(0);
 await page.keyboard.press('Enter');
 await expect(scope.locator('#sentence-prompt')).toHaveText('Das Fahrrad ist rot.');
 await expect(answer).toBeFocused();await expect(answer).toHaveValue('');
 expect(actions.filter(x=>x==='check')).toHaveLength(2);expect(actions.filter(x=>x==='next')).toHaveLength(1);
});
