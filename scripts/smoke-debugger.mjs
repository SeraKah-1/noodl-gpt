import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const out='artifacts/ui';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_BROWSER_CHANNEL?{channel:process.env.PLAYWRIGHT_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'id-ID'});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
async function snap(name){await page.screenshot({path:`${out}/${name}.png`,fullPage:true,animations:'disabled'});}
try{
 await page.goto(process.env.NOODL_UI_URL??'http://127.0.0.1:4173',{waitUntil:'domcontentloaded'});
 for(let i=0;i<45;i++){
  if(await page.locator('.desk-page-head h1').count())break;
  const guest=page.getByRole('button',{name:/Lanjut sebagai guest|Continue as guest/i});
  if(await guest.count()&&await guest.isVisible())await guest.click();
  await page.waitForTimeout(150);
 }
 await page.getByRole('button',{name:'Library',exact:true}).click();
 await page.locator('.classic-upload-label input[type="file"]').setInputFiles('examples/v4-debugger.input.json');
 await page.locator('.desk-library-open').filter({hasText:'V4 Knowledge Debugger QA'}).first().click();
 await page.locator('#desk-pack-title').waitFor();
 await page.locator('.v3-workspace-mobile-tabs button').nth(2).click();
 await page.locator('.v3-studio-actions button').filter({hasText:'Knowledge Debugger'}).click();
 await page.locator('.v4-debugger-root').waitFor();
 const scenario=page.locator('.v4-debugger-case');
 assert.ok((await scenario.innerText()).includes('Water cycle error correction'));
 assert.equal(await scenario.locator('.v4-debugger-edge-list button').count(),2);
 const save=scenario.getByRole('button',{name:'Periksa & simpan koreksi'});
 assert.ok(await save.isDisabled(),'Cannot submit without making a correction');
 await scenario.locator('.v4-debugger-inspector select').selectOption('flows into');
 assert.ok(await save.isEnabled());
 await snap('knowledge-debugger-before');
 await save.click();
 await scenario.locator('.v4-debugger-feedback').waitFor();
 assert.ok((await scenario.locator('.v4-debugger-feedback').innerText()).includes('2 / 2 hubungan benar'));
 assert.ok((await scenario.locator('.v4-debugger-status').innerText()).includes('TIDAK tersimpan ke server'),'Local browser check must never claim cloud persistence');
 assert.ok((await scenario.locator('.v4-debugger-feedback').innerText()).includes('Author-provided water-cycle notes'));
 await snap('knowledge-debugger-after');
 await scenario.getByRole('button',{name:/Coba skenario lagi/}).click();
 assert.ok(await save.isDisabled(),'Reset should restore original faulty labels');
 await page.locator('.v4-debugger-selector select').selectOption('circuit');
 await page.locator('.v4-debugger-case').getByText('Basic electric circuit correction').waitFor();
 await page.locator('.v4-debugger-inspector select').selectOption('supplies energy to');
 await page.getByRole('button',{name:'Periksa & simpan koreksi'}).click();
 await page.locator('.v4-debugger-feedback').waitFor();
 assert.ok((await page.locator('.v4-debugger-feedback').innerText()).includes('1 / 1 hubungan benar'));
 await snap('knowledge-debugger-other-subject');
 await page.setViewportSize({width:320,height:844});
 const measure=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(measure.scroll<=measure.width+1,'Debugger overflow at 320px: '+JSON.stringify(measure));
 await snap('knowledge-debugger-320');
 assert.deepEqual(errors,[]);
 console.log('Noodl V4 debugger browser PASS: two non-gastric scenarios, correction, deterministic result, reset, local persistence honesty, mobile.');
}catch(e){
 await snap('knowledge-debugger-failure').catch(()=>{});
 console.error('Noodl V4 debugger browser FAILED',e,'Exceptions',errors);process.exitCode=1;
}finally{await browser.close();}
