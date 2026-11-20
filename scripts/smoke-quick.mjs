import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const out='artifacts/ui';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_BROWSER_CHANNEL?{channel:process.env.PLAYWRIGHT_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'id-ID'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
async function screenshot(name){await page.screenshot({path:`${out}/${name}.png`,fullPage:true,animations:'disabled'});}
try{
 await page.goto(process.env.NOODL_UI_URL??'http://127.0.0.1:4173',{waitUntil:'domcontentloaded'});
 for(let i=0;i<45;i++){
  if(await page.locator('.desk-page-head h1').count())break;
  const guest=page.getByRole('button',{name:/Lanjut sebagai guest|Continue as guest/i});
  if(await guest.count()&&await guest.isVisible())await guest.click();
  await page.waitForTimeout(200);
 }
 await page.getByRole('button',{name:'Library',exact:true}).click();
 await page.locator('.classic-upload-label input[type="file"]').setInputFiles('examples/pack.input.json');
 await page.locator('.desk-library-open').first().waitFor();
 await page.locator('.classic-nav-inner button').first().click();
 const quick=page.locator('.desk-quick-session');
 await quick.waitFor();
 assert.equal(await quick.locator('.desk-quick-choice').count(),2);
 assert.ok((await quick.innerText()).includes('belum ditampilkan'),'Must disclose unpresented question status');
 await screenshot('quick-sessions-390');
 await quick.locator('.desk-quick-choice').first().click();
 await page.locator('.batch-quiz').waitFor();
 assert.equal(await page.locator('.batch-quiz .question-card').count(),1,'Quick 1 must open exactly one real Batch question');
 assert.ok((await page.locator('.study-counter').innerText()).includes('0 / 1'));
 let field=page.locator('.batch-quiz .question-card').first();
 let input=field.locator('input[type="radio"]');
 if(await input.count())await field.locator('label.batch-choice').first().click();else await field.locator('input').first().fill('answer');
 await page.locator('.batch-submit .study-primary').click();
 await page.locator('.results-screen').waitFor();
 await screenshot('quick-one-results');
 await page.locator('.results-screen .study-icon[aria-label="Kembali"]').click();
 await quick.waitFor();
 const batch=quick.locator('.desk-quick-choice').nth(1);
 assert.ok((await batch.innerText()).includes('2 belum ditampilkan'),'Previously presented question must be marked as a repeat');
 await batch.click();
 await page.locator('.batch-quiz').waitFor();
 assert.equal(await page.locator('.batch-quiz .question-card').count(),3,'Short Batch must persist a 3-question session');
 const cards=page.locator('.batch-quiz .question-card');
 for(let i=0;i<3;i++){
  const q=cards.nth(i),radio=q.locator('input[type="radio"]');
  if(await radio.count())await q.locator('label.batch-choice').first().click();else await q.locator('input').first().fill('answer');
 }
 await page.locator('.batch-submit .study-primary').click();
 await page.locator('.results-screen').waitFor();
 await screenshot('quick-three-results');
 await page.locator('.results-screen .study-icon[aria-label="Kembali"]').click();
 await page.reload({waitUntil:'domcontentloaded'});
 for(let i=0;i<30;i++){if(await page.locator('.desk-last-score').count())break;await page.waitForTimeout(150);}
 assert.ok(await page.locator('.desk-last-score').count(),'Saved Batch result must survive reload');
 await page.setViewportSize({width:320,height:844});
 const metric=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
 assert.ok(metric.scrollWidth<=metric.width+1,'Quick session must not overflow on 320px');
 assert.deepEqual(errors,[]);
 console.log('Noodl Quick Sessions QA PASS: Quick 1 and Batch 3 saved, repeat status correct, reload retains result.');
}catch(error){
 await screenshot('quick-sessions-failure').catch(()=>{});
 console.error('Noodl Quick Sessions QA FAILED',error,'Page exceptions',errors);
 process.exitCode=1;
}finally{await browser.close();}
