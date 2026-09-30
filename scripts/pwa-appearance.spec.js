const { test, expect } = require('playwright/test');
const path = require('node:path');
const fs = require('node:fs/promises');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4023';
const OUTPUT = path.join(process.cwd(), 'artifacts', 'pwa-appearance');
test.use({baseURL: BASE_URL, viewport:{width:1024,height:768}, locale:'de-DE', serviceWorkers:'block'});
test.beforeAll(()=>fs.mkdir(OUTPUT,{recursive:true}));
for (const mode of ['light','dark']) {
 for (const [name,url] of [['teacher','/teacher'],['student','/index.html'],['practice','/index.html?teacherPractice=splash-set']]) {
  test(`${mode}: readable shared splash in ${name}`, async ({page}) => {
   await page.addInitScript(mode=>{
    Object.defineProperty(navigator,'standalone',{value:true,configurable:true});
    for(const scope of ['teacher','student']) localStorage.setItem(`lerndeck-${scope}-appearance-v1`,JSON.stringify({mode}));
   },mode);
   // Hold initialization long enough to inspect the actual splash, then let it finish normally.
   let release;
   const gate=new Promise(resolve=>{release=resolve;});
   await page.route('**/api/**', async route=>{
    await gate;
    const pathname=new URL(route.request().url()).pathname;
    const teacher={id:'julius',displayName:'Julius'};
    let data={};
    if(pathname.endsWith('/runtime-info')) data={publicOrigin:BASE_URL};
    else if(pathname.endsWith('/teacher/session')) data={session:{teacherId:'julius'},teacher};
    else if(pathname.endsWith('/teacher/accounts')) data={accounts:[teacher]};
    else if(pathname.endsWith('/teacher/sets/splash-set')) data={set:{id:'splash-set',path:'sets/food-basics-01.json',status:'published',title:'Ladeprobe',cardCount:6,sourceLanguage:'de',targetLanguage:'en'}};
    else if(pathname.endsWith('/sets')) data={sets:[],teacher};
    else if(pathname.endsWith('/tablets')) data={tablets:[]};
    else if(pathname.endsWith('/visual-jobs')) data={jobs:[]};
    await route.fulfill({json:data});
   });
   try {
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await expect(page.locator('.pwa-splash')).toBeVisible();
    await page.waitForTimeout(750); // Existing entrance animation finishes after 680ms.
    const brand=page.locator('.pwa-splash__brand');
    await expect(brand).toHaveCSS('color',mode==='light'?'rgb(48, 56, 46)':'rgb(230, 234, 240)');
    await expect(page.locator('.pwa-splash__icon')).toHaveCSS('filter','none');
    const contrast=await brand.evaluate(el=>{
      const css=getComputedStyle(document.documentElement);
      const luminance=value=>{
       const rgb=value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
       return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
      };
      const background=css.getPropertyValue('--bg').trim();
      const rgb=background.slice(1).match(/../g).map(v=>parseInt(v,16));
      const a=luminance(getComputedStyle(el).color),b=luminance(`rgb(${rgb.join(',')})`);
      return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({path:path.join(OUTPUT,`${mode}-${name}.png`)});
   } finally {release();}
   await expect(page.locator('.pwa-splash')).toHaveCount(0);
   await expect(page.locator('body')).not.toHaveAttribute('aria-busy','true');
   if(name==='practice') await expect(page.locator('#launch-mode-modal')).toBeVisible();
  });
 }
}
