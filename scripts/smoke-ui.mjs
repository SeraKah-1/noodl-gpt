import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const url=process.env.NOODL_UI_URL??'http://127.0.0.1:4173';
const out='artifacts/ui';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'id-ID'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
async function save(name){await page.screenshot({path:`${out}/${name}.png`,fullPage:true,animations:'disabled'});}
async function fits(width){
 await page.setViewportSize({width,height:844});
 await page.waitForTimeout(100);
 const metrics=await page.evaluate(()=>({innerWidth:window.innerWidth,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
 assert.ok(metrics.scroll<=metrics.client+1,`Horizontal overflow at ${width}px: ${JSON.stringify(metrics)}`);
}
async function waitForSite(){
 for(let n=0;n<45;n++){
  const title=await page.locator('.desk-page-head h1').count();
  if(title)return;
  const guest=page.getByRole('button',{name:/Lanjut sebagai guest|Continue as guest/i});
  if(await guest.count()&&await guest.isVisible())await guest.click();
  await page.waitForTimeout(200);
 }
 throw Error('Today did not load: '+(await page.locator('body').innerText()).slice(0,700));
}
try{
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await waitForSite();
 await save('01-today-empty-mobile');
 await fits(320);await save('02-today-320');await fits(390);
 await page.getByRole('button',{name:'Library',exact:true}).click();
 await page.getByRole('heading',{name:/Bank soal/i}).waitFor();
 await page.locator('.classic-upload-label input[type="file"]').setInputFiles('examples/pack.input.json');
 await page.locator('.desk-library-open').first().waitFor();
 await save('03-library-populated');
 await page.locator('.desk-library-open').first().click();
 await page.locator('#desk-pack-title').getByText('Example question bank').waitFor();
 await save('04-pack-detail');
 await page.getByRole('button',{name:/Mulai latihan/i}).click();
 await page.getByRole('button',{name:/Mulai kuis/i}).click();
 await page.locator('.quiz-screen').waitFor();
 await save('05-focused-quiz');
 await page.locator('.quiz-screen .study-option').first().click();
 await page.getByRole('button',{name:/Simpan dan keluar/i}).click();
 await page.locator('#desk-pack-title').waitFor();
 await page.getByRole('button',{name:/Kembali ke Library/i}).click();
 await page.getByRole('button',{name:/Hari ini/i}).click();
 await page.getByRole('button',{name:/Lanjutkan sesi/i}).waitFor();
 await save('06-resume-available');
 await page.getByRole('button',{name:'Review',exact:true}).click();
 await page.locator('.desk-review .review-stats article').first().waitFor();
 const due=(await page.locator('.desk-review .review-stats article strong').first().innerText()).trim();
 assert.equal(due,'0','New cards must not be counted as overdue');
 await save('07-review-new-vs-due');
 await fits(768);await save('08-review-tablet');
 await fits(1440);await save('09-review-desktop');
 await fits(390);
 await page.getByRole('button',{name:/Lainnya/i}).click();
 await page.getByRole('button',{name:/Pengaturan/i}).click();
 await page.getByRole('heading',{name:/Pengaturan/i}).waitFor();
 await save('10-settings-mobile');
 const themeButtons=page.locator('.theme-grid button');
 assert.equal(await themeButtons.count(),10,'All ten existing themes must remain selectable');
 for(let i=0;i<await themeButtons.count();i++){
  await themeButtons.nth(i).click();
  await fits(390);
  if(i===7)await save('11-settings-midnight');
  if(i===8)await save('12-settings-oled');
 }
 await fits(320);await save('13-settings-paper-320');
 assert.deepEqual(errors,[],`Browser exceptions: ${errors.join('; ')}`);
 console.log('Noodl browser smoke PASS: guest, Today, import, Library, pack detail, quiz answer, resume, Review, settings, 320/390/768/1440 widths.');
}catch(error){
 await save('failure').catch(()=>{});
 console.error('Noodl browser smoke FAILED',error);
 console.error('Page exceptions',errors);
 process.exitCode=1;
}finally{
 await browser.close();
}
