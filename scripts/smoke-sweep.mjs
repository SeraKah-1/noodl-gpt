import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
await mkdir('artifacts/ui',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_BROWSER_CHANNEL?{channel:process.env.PLAYWRIGHT_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'id-ID'});
const page=await context.newPage(),errors=[];
page.on('pageerror',cause=>errors.push(cause.message));
async function shot(id){await page.screenshot({path:`artifacts/ui/${id}.png`,fullPage:true,animations:'disabled'});}
async function openBank(){
 await page.getByRole('button',{name:'Library',exact:true}).click();
 await page.locator('.desk-library-open').filter({hasText:'Example question bank'}).first().click();
 await page.locator('#desk-pack-title').waitFor();
}
async function openSweep(){
 await page.locator('.v3-workspace-mobile-tabs button').nth(2).click();
 await page.locator('.v3-studio-actions button').filter({hasText:'Smart Sweep'}).click();
 await page.locator('.sweep-root').waitFor();
 await page.locator('.sweep-loading').waitFor({state:'hidden'});
}
try{
 await page.goto(process.env.NOODL_UI_URL??'http://127.0.0.1:4173',{waitUntil:'domcontentloaded'});
 for(let i=0;i<45;i++){
  if(await page.locator('.desk-page-head h1').count())break;
  const guest=page.getByRole('button',{name:/Lanjut sebagai guest|Continue as guest/i});
  if(await guest.count()&&await guest.isVisible())await guest.click();
  await page.waitForTimeout(150);
 }
 await page.getByRole('button',{name:'Library',exact:true}).click();
 await page.locator('.classic-upload-label input[type="file"]').setInputFiles('examples/pack.input.json');
 await page.locator('.desk-library-open').first().waitFor();
 await openBank();
 await openSweep();
 assert.equal(await page.locator('.sweep-scan-row').count(),3);
 assert.equal((await page.locator('.sweep-numbers').innerText()).includes('3'),true);
 await page.locator('.sweep-scan-row').nth(0).getByRole('button',{name:/Sudah tahu/}).click();
 await page.locator('.sweep-scan-row').nth(0).locator('button[aria-pressed=true]').waitFor();
 await page.locator('.sweep-scan-row').nth(1).getByRole('button',{name:/Ragu/}).click();
 await page.locator('.sweep-scan-row').nth(1).locator('button[aria-pressed=true]').waitFor();
 await page.locator('.sweep-scan-row').nth(2).focus();
 await page.keyboard.press('1');
 await page.locator('.sweep-scan-row').nth(2).locator('button[aria-pressed=true]').waitFor();
 assert.equal(await page.locator('.sweep-scan-row button[aria-pressed="true"]').count(),3);
 await page.getByRole('button',{name:/Peta cakupan/}).click();
 assert.ok((await page.locator('.sweep-ledger-stats').innerText()).includes('0 / 3'),'Self-claims must not advance tested score');
 assert.ok((await page.locator('.sweep-point-list').innerText()).includes('Mengaku tahu'));
 await shot('sweep-coverage-before-audit');
 await page.getByRole('button',{name:/Scan cepat/}).click();
 const audit=page.locator('.sweep-audit');
 assert.ok((await audit.innerText()).includes('1 ragu'));
 assert.ok((await audit.innerText()).includes('1 klaim tahu diaudit'));
 await audit.getByRole('button',{name:/Mulai Batch verifikasi/}).click();
 await page.locator('.batch-quiz').waitFor();
 assert.equal(await page.locator('.batch-quiz .question-card').count(),2,'Batch should contain one unsure and one known audit');
 const cards=page.locator('.batch-quiz .question-card');
 for(let i=0;i<2;i++){
  const row=cards.nth(i);
  if(await row.locator('label.batch-choice').count())await row.locator('label.batch-choice').first().click();
  else await row.locator('input').first().fill('answer');
 }
 await page.locator('.batch-submit .study-primary').click();
 await page.locator('.results-screen').waitFor();
 await shot('sweep-audit-saved-results');
 await page.locator('.results-screen .study-icon[aria-label="Kembali"]').click();
 await page.reload({waitUntil:'domcontentloaded'});
 for(let i=0;i<40;i++){if(await page.locator('.desk-page-head h1').count())break;await page.waitForTimeout(140);}
 await openBank();await openSweep();
 assert.ok(await page.locator('.sweep-scan-row button[aria-pressed="true"]').count()>=1,'Saved self-assessment survives reload');
 await page.getByRole('button',{name:/Peta cakupan/}).click();
 assert.ok((await page.locator('.sweep-ledger-stats').innerText()).includes('2 / 3'),'Real graded Batch updates only independently answered question count');
 await page.getByRole('button',{name:/Kerjakan seluruh bank tanpa filter/}).click();
 await page.locator('.practice-screen.quiz-screen').waitFor();
 assert.ok((await page.locator('.study-top small').first().innerText()).includes('STANDARD'));
 assert.ok((await page.locator('.study-counter').innerText()).includes('dari 3'),'Full Exam must contain all 3 original questions');
 await page.setViewportSize({width:320,height:844});
 const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
 assert.ok(size.scrollWidth<=size.width+1,'No 320px overflow after Full Exam');
 assert.deepEqual(errors,[]);
 console.log('Noodl V5 Smart Sweep PASS: local claims, audit Batch, refresh evidence, Full Exam all original questions.');
}catch(e){
 await shot('sweep-failure').catch(()=>{});
 console.error('Noodl V5 Smart Sweep FAILED',e,'Page errors',errors);process.exitCode=1;
}finally{await browser.close();}
