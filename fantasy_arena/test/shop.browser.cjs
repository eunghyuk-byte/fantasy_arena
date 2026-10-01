const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'}),headless:true});
 try{
  fs.mkdirSync('shop-qa',{recursive:true});
  const page=await browser.newPage({viewport:{width:1672,height:941}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765');await page.click('#btnShop');
  assert.equal(await page.locator('.shop-product').count(),3,'three approved pack options');
  assert.deepEqual(await page.locator('.shop-product h2').allTextContents(),['1팩','5팩','10팩']);
  assert.deepEqual(await page.locator('.shop-card-count').allTextContents(),['카드 5장','카드 25장','카드 50장']);
  assert.deepEqual(await page.locator('.shop-price').allTextContents(),['1,500원','5,900원','9,900원']);
  assert.deepEqual(await page.locator('.shop-discount').allTextContents(),['약 21% 할인','34% 할인']);
  assert.match(await page.locator('#shopAvailability').innerText(),/결제.*미연동/);
  assert.match(await page.locator('#ownedPackCount').innerText(),/미연동/);
  await page.waitForTimeout(800);const storage=await page.evaluate(()=>JSON.stringify({...localStorage}));
  for(const [i,price] of ['1,500원','5,900원','9,900원'].entries()){
    const button=page.locator('.shop-buy').nth(i);await button.click();
    assert.equal(await page.locator('#shopInfo').evaluate(el=>el.open),true);
    assert.match(await page.locator('#shopInfoText').innerText(),new RegExp(price));
    assert.match(await page.locator('#shopInfoText').innerText(),/구매.*불가/);
    await page.keyboard.press('Escape');assert.equal(await button.evaluate(el=>el===document.activeElement),true);
  }
  await page.click('#btnPackOpen');assert.match(await page.locator('#shopInfoText').innerText(),/보유 팩.*미연동/);
  await page.screenshot({path:'shop-qa/pack-unavailable.png'});await page.click('#btnShopInfoClose');
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),storage,'no purchase, pack or account mutation');
  await page.screenshot({path:'shop-qa/shop-desktop.png'});
  for(const [w,h] of [[844,390],[568,320],[360,640]]){
    await page.setViewportSize({width:w,height:h});await page.waitForTimeout(200);
    for(const id of ['btnShopBack','btnPackOpen']){await page.locator('#'+id).scrollIntoViewIfNeeded();const b=await page.locator('#'+id).boundingBox();assert.ok(b.height>=44&&b.x>=0&&b.x+b.width<=w&&b.y>=0&&b.y+b.height<=h);}
    for(const button of await page.locator('.shop-buy').all()){await button.scrollIntoViewIfNeeded();const b=await button.boundingBox();assert.ok(b.height>=44&&b.x>=0&&b.x+b.width<=w&&b.y>=0&&b.y+b.height<=h);await button.click();await page.click('#btnShopInfoClose');}
    await page.locator('#btnShopBack').scrollIntoViewIfNeeded();await page.screenshot({path:`shop-qa/shop-${w}x${h}.png`});
  }
  await page.click('#btnShopBack');assert.equal(await page.locator('#title').evaluate(el=>el.classList.contains('active')),true);
  const touch=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const tp=await touch.newPage();await tp.goto('http://127.0.0.1:8765');await tp.locator('#btnShop').tap();await tp.locator('.shop-buy').first().tap();assert.equal(await tp.locator('#shopInfo').evaluate(el=>el.open),true);await tp.locator('#btnShopInfoClose').tap();await touch.close();
  assert.deepEqual(errors,[]);console.log('PASS: three product prices/counts, truthful unavailable states, no storage mutation, dialog keyboard/focus, four viewports, touch and return.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
