import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const base=process.env.GAME_URL,errors=[];
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const cdp=await context.newCDPSession(page),points=new Map();
const centre=async selector=>{const b=await page.locator(selector).boundingBox();assert(b,selector);return {x:b.x+b.width/2,y:b.y+b.height/2}};
async function touch(type,id,position){
 const ending=points.get(id);if(type==='touchEnd'||type==='touchCancel')points.delete(id);else points.set(id,{id,...position});
 await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchCancel'?[]:type==='touchEnd'?[ending]:[...points.values()]});await page.waitForTimeout(50);
}
try{
 await page.goto(base);await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.enemies=[{x:720,hp:500,max:500,next:999,speed:0,kind:0}];s.survivors=[];s.spawned=0;s.x=650});
 assert(await page.evaluate(()=>document.body.classList.contains('touch-layout')));
 const right=await centre('[data-key=D]'),sword=await centre('[data-key=J]');
 await touch('touchStart',1,right);await touch('touchStart',2,sword);
 await page.waitForFunction(()=>window.elowen.x>665&&window.elowen.enemies[0].hp<500);
 await touch('touchEnd',2);assert(await page.evaluate(()=>window.elowen.touch.has('D')&&!window.elowen.touch.has('J')));
 await touch('touchEnd',1);assert.equal(await page.evaluate(()=>window.elowen.touch.size),0);
 await page.evaluate(()=>{const s=window.elowen;s.x=650;s.enemies=[];s.energy=100;s.spellCooldowns={}});
 await touch('touchStart',1,right);await touch('touchStart',2,await centre('[data-spell=ember]'));await touch('touchEnd',2);
 await page.waitForFunction(()=>window.elowen.energy<90);assert(await page.evaluate(()=>window.elowen.touch.has('D')));await touch('touchEnd',1);
 await touch('touchStart',1,right);await touch('touchMove',1,await centre('[data-key=S]'));await page.waitForFunction(()=>window.elowen.crouching);
 assert(await page.evaluate(()=>!window.elowen.touch.has('D')&&window.elowen.touch.has('S')));
 await touch('touchMove',1,{x:300,y:200});assert.equal(await page.evaluate(()=>window.elowen.touch.size),0);
 await touch('touchMove',1,await centre('[data-key=A]'));assert(await page.evaluate(()=>window.elowen.touch.has('A')));await touch('touchCancel',1);
 assert.equal(await page.evaluate(()=>window.elowen.touch.size),0);
 await touch('touchStart',1,right);await touch('touchStart',2,await centre('[data-key=L]'));await page.waitForFunction(()=>window.elowen.blocking);await touch('touchEnd',2);await touch('touchEnd',1);
 await touch('touchStart',1,await centre('[data-key=SPACE]'));await page.waitForFunction(()=>window.elowen.y<400);await touch('touchEnd',1);await page.waitForFunction(()=>window.elowen.y===422);
 await touch('touchStart',1,right);await touch('touchStart',2,await centre('.touch-pause'));await touch('touchEnd',2);
 await page.locator('#resume').waitFor();assert.equal(await page.evaluate(()=>window.elowen.touch.size),0);await touch('touchEnd',1);await page.locator('#resume').click();
 await touch('touchStart',1,right);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.evaluate(()=>window.elowen.touch.size),0);await touch('touchEnd',1);
 await page.evaluate(()=>{const s=window.elowen;s.upgrades.push('ice','ward','volley','stone','vines');s.abilitySlots=['reach','focus','cripple'];s.kActive='rally';s.updateHotbar()});
 const geometry=await page.evaluate(()=>Array.from(document.querySelectorAll('.touch button,.spellbar button,.championbar button')).filter(b=>b.getBoundingClientRect().width>0).map(b=>{const r=b.getBoundingClientRect();return {label:b.getAttribute('aria-label'),x:r.x,y:r.y,w:r.width,h:r.height}}));
 assert(geometry.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=844.1&&r.y+r.h<=390.1&&r.w>=48&&r.h>=48),JSON.stringify(geometry));
 await touch('touchStart',1,right);await touch('touchStart',2,{x:right.x+4,y:right.y});await touch('touchEnd',1);assert(await page.evaluate(()=>window.elowen.touch.has('D')));await touch('touchEnd',2);
 await touch('touchStart',1,right);await touch('touchStart',2,await centre('[data-ability-key=U]'));await touch('touchEnd',2);assert(await page.evaluate(()=>window.elowen.reachTime>0&&window.elowen.touch.has('D')));await touch('touchEnd',1);
 await page.screenshot({path:'mobile-landscape.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
 assert(await page.evaluate(()=>Array.from(document.querySelectorAll('.touch button')).every(b=>{const r=b.getBoundingClientRect();return r.x>=0&&r.right<=390&&r.bottom<=844})));
 await page.screenshot({path:'mobile-portrait.png'});
 await page.setViewportSize({width:320,height:568});await page.waitForTimeout(150);
 assert(await page.evaluate(()=>Array.from(document.querySelectorAll('.touch button,.spellbar button,.championbar button')).filter(b=>b.getBoundingClientRect().width>0).every(b=>{const r=b.getBoundingClientRect();return r.x>=0&&r.right<=320.1&&r.bottom<=568.1&&r.width>=48&&r.height>=48})),'small phone targets fit');
 await page.evaluate(()=>window.elowen.begin());assert.equal(await page.evaluate(()=>window.elowen.touch.size),0);
 const desktop=await browser.newPage({viewport:{width:1440,height:1000}});await desktop.goto(base);await desktop.locator('#begin').click();assert(!(await desktop.locator('.touch').isVisible()));await desktop.keyboard.down('D');await desktop.waitForFunction(()=>window.elowen.x>530);await desktop.keyboard.up('D');await desktop.close();
 assert.deepEqual(errors,[]);console.log('PASS: landscape and portrait layouts, 48px targets, movement+attack/spell/block, jump, sliding/re-entry, multi-touch releases, cancellation, pause/resume, blur, restart and desktop keyboard.');
}finally{await browser.close()}



