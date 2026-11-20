import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const out='artifacts/ui';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_BROWSER_CHANNEL?{channel:process.env.PLAYWRIGHT_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'id-ID'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',cause=>errors.push(cause.message));
async function shot(name){await page.screenshot({path:`${out}/${name}.png`,fullPage:true,animations:'disabled'});}
try{
 await page.goto(process.env.NOODL_UI_URL??'http://127.0.0.1:4173',{waitUntil:'domcontentloaded'});
 for(let i=0;i<45;i++){
  if(await page.locator('.desk-page-head h1').count())break;
  const guest=page.getByRole('button',{name:/Lanjut sebagai guest|Continue as guest/i});
  if(await guest.count()&&await guest.isVisible())await guest.click();
  await page.waitForTimeout(180);
 }
 await page.getByRole('button',{name:'Library',exact:true}).click();
 await page.locator('.classic-upload-label input[type="file"]').setInputFiles('examples/v4-comic.input.json');
 await page.locator('.desk-library-open').filter({hasText:'V4 Comic reader QA'}).first().click();
 await page.locator('#desk-pack-title').waitFor();
 await page.locator('.v3-workspace-mobile-tabs button').nth(2).click();
 await page.locator('.v3-studio-actions button').filter({hasText:/Komik/}).click();
 await page.locator('.comic-reader').waitFor();
 assert.ok((await page.locator('.comic-asset-status').innerText()).includes('1 dari 2'),'Artwork availability must be truthfully shown');
 assert.ok(await page.locator('.comic-focus-surface img').count(),'First saved illustration must render');
 assert.ok((await page.locator('.comic-reader-toolbar').innerText()).includes('Panel 1 / 2'));
 await shot('comic-focus-first');
 await page.getByRole('button',{name:/Berikutnya/}).click();
 assert.ok((await page.locator('.comic-reader-toolbar').innerText()).includes('Panel 2 / 2'));
 assert.ok((await page.locator('.comic-storyboard').innerText()).includes('ilustrasi belum tersedia'),'Missing illustration must be labeled storyboard');
 assert.ok(await page.getByRole('button',{name:/Berikutnya/}).isDisabled());
 await shot('comic-storyboard-second');
 await page.locator('.comic-focus-surface').focus();
 await page.keyboard.press('ArrowLeft');
 assert.ok((await page.locator('.comic-reader-toolbar').innerText()).includes('Panel 1 / 2'),'Keyboard navigation must operate on focused reader');
 await page.getByRole('button',{name:/Perbesar gambar/}).click();
 assert.ok(await page.locator('.comic-focus-surface.is-zoomed').count());
 await page.getByRole('button',{name:/Ukuran normal/}).click();
 await page.getByRole('button',{name:/Lihat semua/}).click();
 assert.equal(await page.locator('.comic-panels .comic-panel').count(),2);
 await page.getByRole('button',{name:'Buka panel 2'}).click();
 assert.ok((await page.locator('.comic-reader-toolbar').innerText()).includes('Panel 2 / 2'));
 await page.setViewportSize({width:320,height:844});
 await page.waitForTimeout(80);
 const screen=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
 assert.ok(screen.scrollWidth<=screen.width+1,'No horizontal overflow on 320px comic reader: '+JSON.stringify(screen));
 await shot('comic-focus-320');
 assert.deepEqual(errors,[]);
 console.log('Noodl V4 comic QA PASS: saved art, missing image honesty, focused/grid, keyboard, zoom, responsive.');
}catch(cause){
 await shot('comic-failure').catch(()=>{});
 console.error('Noodl V4 comic QA FAILED',cause,'Page errors',errors);
 process.exitCode=1;
}finally{await browser.close();}
