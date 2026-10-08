import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');
 await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.enemies=[];s.survivors=[];s.spawned=0;});
 assert(await page.evaluate(()=>window.elowen.heroAnimator.clips.crouchSlash?.meta.frameCount===6));
 for(const face of [1,-1])for(const extended of [false,true]) {
  await page.evaluate(({face,extended})=>{
   const s=window.elowen;s.x=650;s.y=422;s.vy=0;s.face=face;s.attackCd=0;s.reachTime=extended?8:0;s.heroAnimator.reset();
   const range=extended?230:115;
   s.enemies=[range-5,range+5].map(dx=>({x:s.x+face*dx,hp:160,max:160,next:999,speed:0,kind:0}));
  },{face,extended});
  await page.keyboard.down('S');
  await page.waitForFunction(()=>window.elowen.heroAnimator.crouchProgress===.4);
  await page.keyboard.down('J');
  await page.waitForFunction(()=>window.elowen.heroAnimator.attack?.kind==='crouchSlash');
  await page.keyboard.up('J');
  const hit=await page.evaluate(()=>{const s=window.elowen;return {hp:s.enemies.map(e=>e.hp),damage:s.damage,cd:s.attackCd}});
  assert.deepEqual(hit.hp,[160-hit.damage,160],'crouched sword preserves normal and extended hit limits');
  assert(hit.cd>0&&hit.cd<=.42,'sword cadence unchanged');
  await page.evaluate(()=>window.elowen.paused=true);
  const samples=await page.evaluate(()=>{
   const s=window.elowen,a=s.heroAnimator,clip=a.clips.crouchSlash,ds=clip.meta.durationsMs,total=ds.reduce((n,v)=>n+v,0);
   return ds.map((_,frame)=>{
    a.attack.elapsed=(ds.slice(0,frame).reduce((n,v)=>n+v,0)+1)/total*.42;s.draw();
    const im=s.spritePool.find(i=>i.visible&&i.getData('heroAction')==='crouchSlash');
    return {frame:im.getData('heroFrame'),flip:im.flipX,scale:im.scaleY,feet:im.y+(clip.feet[frame]-im.originY*clip.meta.frameHeight)*im.scaleY,beam:a.beam.visible,far:a.beam.getData('farX')};
   });
  });
  assert.deepEqual(samples.map(s=>s.frame),[0,1,2,3,4,5]);
  assert(samples.every(s=>s.flip===(face<0)&&Math.abs(s.feet-422)<.01&&Math.abs(s.scale-96/432)<.001),'fixed anatomical scale, mirrored facing and grounded feet');
  assert.deepEqual(samples.map(s=>s.beam),extended?[false,false,false,true,true,false]:[false,false,false,false,false,false]);
  if(extended)assert(samples.filter(s=>s.beam).every(s=>s.far===650+face*230));
  await page.screenshot({path:`crouch-sword-${face}-${extended}.png`});
  await page.evaluate(()=>window.elowen.paused=false);
  await page.waitForFunction(()=>window.elowen.heroAnimator.attack===null);
  assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.pose(0)?.kind),'crouch','returns to crouched hold');
  await page.evaluate(()=>window.elowen.enemies=[]);
  await page.keyboard.up('S');
  await page.waitForFunction(()=>window.elowen.heroAnimator.crouchProgress===0);
 }
 await page.keyboard.down('S');await page.keyboard.down('J');
 await page.waitForFunction(()=>window.elowen.heroAnimator.attack?.kind==='crouchSlash');
 await page.keyboard.up('J');await page.keyboard.up('S');
 await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
 const before=await page.evaluate(()=>window.elowen.heroAnimator.attack?.elapsed);
 await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.attack?.elapsed),before,'pause freezes slash');
 await page.locator('#resume').click();
 await page.waitForFunction(()=>window.elowen.heroAnimator.attack===null);
 await page.evaluate(()=>{const s=window.elowen;s.reachTime=0;s.heroAnimator.reset();s.attackCd=0;});
 await page.keyboard.down('J');await page.waitForFunction(()=>window.elowen.heroAnimator.attack?.kind==='slash');await page.keyboard.up('J');
 await page.evaluate(()=>window.elowen.begin());
 assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.attack),null);
 assert.deepEqual(errors,[]);
 console.log('PASS: six crouched slash poses, both facings, fixed scale and foot anchors, normal/extended damage limits, reach energy, crouch recovery, pause, standing slash and restart.');
} finally {await browser.close()}
