import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const url=process.env.NOODL_UI_URL??'http://127.0.0.1:4173';
const out='artifacts/ui';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_BROWSER_CHANNEL?{channel:process.env.PLAYWRIGHT_BROWSER_CHANNEL}:{})});
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
 const editorial=await page.evaluate(()=>{
  const style=selector=>getComputedStyle(document.querySelector(selector));
  return {
   theme:document.documentElement.dataset.noodlTheme,
   nav:style('.desk-nav .classic-nav-inner').backgroundColor,
   selectedNav:getComputedStyle(document.querySelector('.desk-nav .v3-nav-indicator')??document.querySelector('.desk-nav button[aria-current="page"]')).backgroundColor,
   hero:style('.desk-next').backgroundColor,
   action:style('.desk-next .desk-primary').backgroundColor
  };
 });
 assert.deepEqual(editorial,{theme:'default',nav:'rgb(23, 42, 54)',selectedNav:'rgb(255, 186, 89)',hero:'rgb(23, 42, 54)',action:'rgb(255, 186, 89)'},'V3 Slate theme must use dark structure and Amber focused actions');
 const visualSystem=await page.evaluate(()=>{
  const css=selector=>getComputedStyle(document.querySelector(selector));
  return {
   brandFamily:css('.classic-wordmark').fontFamily,
   pageFamily:css('.desk-page-head h1').fontFamily,
   featureFamily:css('.desk-next h2').fontFamily,
   sectionFamily:css('.desk-section-heading h2').fontFamily,
   sectionRule:css('.desk-queue').borderTopWidth,
   actionTextSize:parseFloat(css('.desk-next .desk-primary').fontSize),
   titleSize:parseFloat(css('.desk-page-head h1').fontSize),
   controlBoundary:css('.classic-account').borderTopWidth
  };
 });
 assert.equal(visualSystem.pageFamily,visualSystem.brandFamily,'Page title and wordmark must use one type family');
 assert.equal(visualSystem.featureFamily,visualSystem.pageFamily,'Feature heading must share type family');
 assert.equal(visualSystem.sectionFamily,visualSystem.pageFamily,'Section titles must share type family');
 assert.equal(visualSystem.sectionRule,'2px','Secondary sections need a deliberate visible boundary');
 assert.ok(visualSystem.actionTextSize>=14,'Primary action typography must remain readable');
 assert.ok(visualSystem.titleSize>visualSystem.actionTextSize*2,'Page heading must establish clear hierarchy');
 assert.equal(visualSystem.controlBoundary,'1px','Controls must have a visible boundary');
 await save('01-today-empty-mobile');
 await fits(320);await save('02-today-320');await fits(390);
 await page.getByRole('button',{name:'Library',exact:true}).click();
 await page.getByRole('heading',{name:/Bank soal/i}).waitFor();
 const selectedBankTab=await page.locator('.classic-input-tabs button[aria-pressed="true"]').evaluate(el=>{
  const s=getComputedStyle(el);return {color:s.color,background:s.backgroundColor};
 });
 assert.deepEqual(selectedBankTab,{color:'rgb(255, 255, 255)',background:'rgb(23, 42, 54)'},'Library selected tab must use readable Slate/White state');
 await page.locator('.classic-upload-label input[type="file"]').setInputFiles('examples/pack.input.json');
 await page.locator('.desk-library-open').first().waitFor();
 assert.equal(await page.locator('.desk-library-index').first().innerText(),'01','Library must be indexed without boxed icons');
 await save('03-library-populated');
 await page.locator('.desk-library-open').first().click();
 await page.locator('#desk-pack-title').getByText('Example question bank').waitFor();
 // Materials, learning canvas and studio are real and connected to the selected bank.
 assert.equal(await page.locator('.v3-workspace-columns').count(),1,'Bank must open functional three-column workspace');
 assert.ok(await page.locator('.v3-studio-actions button').count()>=3,'Existing tools must remain operable');
 await save('04-pack-detail');
 await page.getByRole('button',{name:/Materi/i}).filter({has:page.locator('svg')}).first().count();
 await page.getByRole('button',{name:/Mulai latihan/i}).click();
 await page.getByRole('button',{name:/Mulai kuis/i}).click();
 await page.locator('.quiz-screen').waitFor();
 const quizSurface=await page.evaluate(()=>{
  const card=document.querySelector('.quiz-screen .question-card');
  const binary=document.querySelector('.quiz-screen .study-binary .study-option');
  const cardStyle=card?getComputedStyle(card):null;
  const binaryStyle=binary?getComputedStyle(binary):null;
  return {theme:document.documentElement.dataset.noodlTheme,cardBorder:cardStyle?.borderTopWidth,cardBg:cardStyle?.backgroundColor,binaryBorder:binaryStyle?.borderTopWidth,binaryBg:binaryStyle?.backgroundColor};
 });
 console.log('VISUAL_QUIZ_COMPUTED',JSON.stringify(quizSurface));
 assert.equal(quizSurface.theme,'default','Quiz must retain active Slate theme');
 assert.ok(parseFloat(quizSurface.cardBorder)>=1,'Fullscreen quiz reading sheet must have a real visible border');
 assert.notEqual(quizSurface.cardBg,'rgba(0, 0, 0, 0)','Fullscreen quiz reading sheet must have a real surface');
 if(quizSurface.binaryBorder){
  assert.ok(parseFloat(quizSurface.binaryBorder)>=1,'True/false choices must have visible borders');
 }
 await save('05-focused-quiz');
 const options=page.locator('.quiz-screen .study-option');
 if(await options.count())await options.first().click();
 else{
  const field=page.locator('.quiz-screen .study-fill input');
  if(!await field.count())throw new Error('No usable answer controls in quiz');
  await field.fill('-2');
  await page.locator('.quiz-screen .study-fill button[type="submit"]').click();
 }
 await page.getByRole('button',{name:/Simpan dan keluar/i}).click();
 await page.locator('#desk-pack-title').waitFor();
 await page.getByRole('button',{name:/Kembali ke Library/i}).click();
 await page.getByRole('button',{name:/Hari ini/i}).click();
 await page.getByRole('button',{name:/Lanjutkan sesi/i}).waitFor();
 await save('06-resume-available');
 await page.getByRole('button',{name:'Review',exact:true}).click();
 await page.locator('.desk-review .review-stats article').first().waitFor();
 const reviewStyle=await page.locator('.desk-review .review-stats article').first().evaluate(el=>({radius:getComputedStyle(el).borderRadius,background:getComputedStyle(el).backgroundColor}));
 assert.equal(reviewStyle.radius,'0px','Review status should scan like text, not a card');
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
 const themeButtons=page.locator('.v3-theme-choice');
 assert.equal(await themeButtons.count(),12,'Slate, Editorial and ten original themes must remain selectable');
 const priorTheme=await page.evaluate(()=>document.documentElement.dataset.noodlTheme);
 await page.getByRole('button',{name:/Focus Indigo/i}).click();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.noodlTheme),priorTheme,'Theme preview must not persist before Save');
 await page.getByRole('button',{name:/Batalkan/i}).click();
 assert.equal(await page.locator('.v3-theme-choice[aria-pressed="true"]').count(),1,'Cancel returns selected saved theme');
 await page.getByRole('button',{name:/Default latihan/i}).click();
 await page.getByRole('button',{name:/Batch/i}).first().click();
 assert.ok(await page.getByRole('button',{name:/Simpan perubahan/i}).isEnabled(),'Study preferences are real editable controls');
 await page.getByRole('button',{name:/Batalkan/i}).click();
 await page.getByRole('button',{name:/Tampilan/i}).click();
 await save('11-settings-preview');
 await page.getByRole('button',{name:/Aksesibilitas/i}).click();
 const reduced=page.getByRole('checkbox',{name:/Kurangi animasi/i});
 await reduced.check();
 assert.ok(await page.getByRole('button',{name:/Simpan perubahan/i}).isEnabled(),'Reduced-motion change must be savable');
 await page.getByRole('button',{name:/Batalkan/i}).click();
 await fits(320);await save('12-settings-320');
 await fits(768);await save('13-settings-tablet');
 await fits(1440);await save('14-settings-desktop');
 // Complete the persisted practice with actual answers and inspect actionable Results.
 await fits(390);
 await page.getByRole('button',{name:'Hari ini',exact:true}).click();
 await page.getByRole('button',{name:/Lanjutkan sesi/i}).click();
 await page.locator('.quiz-screen').waitFor();
 for(let i=0;i<12;i++){
  if(await page.locator('.results-screen').count())break;
  if(!await page.locator('.quiz-screen').count())throw Error('Practice disappeared before completion');
  if(!await page.locator('.quiz-screen .study-feedback').count()){
   const choices=page.locator('.quiz-screen .study-option');
   if(await choices.count())await choices.last().click();
   else{
    const input=page.locator('.quiz-screen .study-fill input');
    if(!await input.count())throw Error('Missing answer control during real attempt');
    await input.fill('intentionally incorrect answer');
    await page.locator('.quiz-screen .study-fill button[type="submit"]').click();
   }
   await page.locator('.quiz-screen .study-feedback').waitFor();
  }
  await page.locator('.quiz-screen .study-bottom .study-primary').click();
  await page.waitForTimeout(100);
 }
 await page.locator('.results-screen').waitFor({timeout:10000});
 assert.ok(await page.locator('.study-score').count()>=1,'Results must display score from the completed attempt');
 assert.ok(await page.locator('.v3-mistake-loop').count()>=1,'Incorrect answers must offer evidence-based error repair');
 await save('15-results-repair-loop');
 assert.deepEqual(errors,[],`Browser exceptions: ${errors.join('; ')}`);
 console.log('Noodl V3 browser smoke PASS: real Today, import, Bank Workspace, quiz, resume, review, Settings preview/Cancel, 320/390/768/1440 widths.');
}catch(error){
 await save('failure').catch(()=>{});
 console.error('Noodl browser smoke FAILED',error);
 console.error('Page exceptions',errors);
 process.exitCode=1;
}finally{
 await browser.close();
}
