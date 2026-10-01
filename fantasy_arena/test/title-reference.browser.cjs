// Structural checks are not a design-match verdict. Supply an approved local PNG
// only after its transfer is authorized: node .../title-reference.browser.cjs reference.png
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const out = path.resolve('reference-qa');
  fs.mkdirSync(out, {recursive:true});
  const browser = await chromium.launch({...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {channel:'chrome'}),headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1672,height:941}});
    await page.goto('http://127.0.0.1:8765');
    await page.waitForTimeout(700);
    const geometry = await page.evaluate(() => {
      const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      return {logo:box('.title-logo'),menu:box('#titleMenu'),backgroundSize:getComputedStyle(document.querySelector('#title')).backgroundSize};
    });
    assert.ok(Math.abs(geometry.logo.top - 60) < 1, 'logo anchored to approved reference');
    assert.ok(Math.abs(geometry.logo.width - 570) < 1, 'logo crop retains reference scale');
    assert.ok(Math.abs(geometry.menu.top - 444) < 1, 'menu starts at approved reference position');
    assert.ok(Math.abs(geometry.logo.x - 560) < 1, 'logo retains reference horizontal position');
    assert.ok(geometry.logo.top + geometry.logo.height <= geometry.menu.top + 2, 'logo crop ends before first button art');
    assert.ok(geometry.backgroundSize.includes('contain'), 'background is contained without cropping');
    fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(geometry,null,2));
    await page.mouse.move(0,0);
    await page.screenshot({path:path.join(out,'implementation-rest-1672x941.png')});
    await page.hover('#btnLobby'); await page.waitForTimeout(200);
    await page.screenshot({path:path.join(out,'implementation-1672x941.png')});
    const reference = process.argv[2];
    if (!reference) {
      console.log('PASS: structural checks; resting and hovered screenshots saved. Reference comparison skipped: no approved local PNG supplied.');
      return;
    }
    const referenceData = 'data:image/png;base64,' + fs.readFileSync(reference).toString('base64');
    const actualData = 'data:image/png;base64,' + fs.readFileSync(path.join(out,'implementation-1672x941.png')).toString('base64');
    const images = await page.evaluate(async ({referenceData,actualData}) => {
      const load = src => new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});
      const [ref,actual] = await Promise.all([load(referenceData),load(actualData)]);
      if(ref.naturalWidth!==1672 || ref.naturalHeight!==941) throw Error('Reference must be original 1672x941; do not silently rescale.');
      const canvas=document.createElement('canvas');canvas.width=1672;canvas.height=941;
      const ctx=canvas.getContext('2d');ctx.drawImage(ref,0,0);ctx.globalAlpha=.5;ctx.drawImage(actual,0,0);
      const overlay=canvas.toDataURL('image/png');
      ctx.globalAlpha=1;ctx.clearRect(0,0,1672,941);ctx.drawImage(ref,0,0);ctx.globalCompositeOperation='difference';ctx.drawImage(actual,0,0);
      return {overlay,difference:canvas.toDataURL('image/png')};
    },{referenceData,actualData});
    for(const [name,data] of Object.entries(images)) fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.split(',')[1],'base64'));
    console.log('Comparison artifacts generated; manual visual review is required. No automatic design-match verdict.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
