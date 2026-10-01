// Pixel regression for the supplied local reference, not a whole-screen match verdict.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
  assert.ok(process.argv[2], 'Supply the approved local PNG');
  const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'}),headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1672,height:941}});
    await page.goto('http://127.0.0.1:8765'); await page.waitForTimeout(700);
    const actual=(await page.screenshot()).toString('base64');
    const expected=fs.readFileSync(process.argv[2]).toString('base64');
    const error=await page.evaluate(async({actual,expected})=>{
      const load=src=>new Promise(resolve=>{const image=new Image(); image.onload=()=>resolve(image);image.src='data:image/png;base64,'+src;});
      const [a,e]=await Promise.all([load(actual),load(expected)]);
      const canvas=document.createElement('canvas');canvas.width=1672;canvas.height=941;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(a,0,0);const ap=ctx.getImageData(580,270,530,65).data;
      ctx.drawImage(e,0,0);const ep=ctx.getImageData(580,270,530,65).data;
      let sum=0;for(let i=0;i<ap.length;i++) if(i%4!==3)sum+=Math.abs(ap[i]-ep[i]);
      return sum/(530*65*3);
    },{actual,expected});
    assert.ok(error<4, `Original wordmark pixels must be preserved; mean channel error=${error.toFixed(3)}`);
    // Hide only DOM labels so visual review can detect any source-text leakage.
    await page.addStyleTag({content:'#title .menu-label { visibility:hidden; }'});
    await page.hover('#btnLobby');
    fs.mkdirSync('reference-qa',{recursive:true});
    await page.screenshot({path:'reference-qa/source-plates-without-labels.png'});
    console.log('PASS: original wordmark pixel fidelity, mean channel error='+error.toFixed(3));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
