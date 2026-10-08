import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.enemies=[];s.survivors=[];s.spawned=0;});
 assert(await page.evaluate(()=>window.elowen.heroAnimator.clips.crouchWalk?.meta.frameCount===6));
 for(const [key,face] of [['D',1],['A',-1]]) {
  await page.evaluate(()=>{const s=window.elowen;s.x=650;s.heroAnimator.reset();s.data.set('crouchWalkSamples',[]);
   const observe=()=>{const im=s.spritePool.find(i=>i.visible&&i.getData('heroAction')==='crouchWalk');if(im){const c=s.heroAnimator.clips.crouchWalk,f=im.getData('heroFrame');s.data.get('crouchWalkSamples').push({frame:f,scale:im.scaleY,flip:im.flipX,foot:im.y+(c.feet[f]-im.originY*512)*im.scaleY});}};
   s.events.on('postupdate',observe);s.data.set('crouchWalkObserver',observe);
  });
  await page.keyboard.down('S');await page.keyboard.down(key);
  await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)?.kind==='crouchWalk');
  await page.waitForTimeout(1650);
  const samples=await page.evaluate(()=>{const s=window.elowen;s.events.off('postupdate',s.data.get('crouchWalkObserver'));return s.data.get('crouchWalkSamples')});
  assert.deepEqual([...new Set(samples.map(s=>s.frame))].sort(),[0,1,2,3,4,5]);
  assert(samples.every(s=>s.flip===(face<0)&&Math.abs(s.foot-422)<.01&&Math.abs(s.scale-96/580)<.001));
  assert(samples.some((s,i)=>i&&s.frame<samples[i-1].frame),'walk cycle loops');
  const speed=await page.evaluate(()=>{const s=window.elowen,x=s.x;s.tick(.1);return Math.abs(s.x-x)});
  assert(Math.abs(speed-9)<.01,'existing crouched speed remains 90 px/s');
  await page.screenshot({path:`crouch-walk-${face}.png`});
  await page.evaluate(()=>window.elowen.x=650);
  await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
  const frozen=await page.evaluate(()=>window.elowen.heroAnimator.walkElapsed);await page.waitForTimeout(120);
  assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.walkElapsed),frozen);
  await page.locator('#resume').click();
  await page.keyboard.down('L');await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)?.kind==='crouchBlock');
  await page.keyboard.up('L');await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)?.kind==='crouchWalk');
  await page.evaluate(()=>window.elowen.x=650);
  await page.keyboard.down('J');await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)?.kind==='crouchSlash');await page.keyboard.up('J');
  await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)?.kind==='crouchWalk');
  await page.keyboard.up(key);await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)?.kind==='crouch');
  await page.evaluate(()=>window.elowen.x=650);
  await page.keyboard.up('S');await page.keyboard.down(key);await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)?.kind==='walk');await page.keyboard.up(key);
 }
 await page.keyboard.down('S');await page.keyboard.down('A');await page.keyboard.down('D');
 await page.waitForFunction(()=>window.elowen.heroAnimator.crouchProgress===.4&&!window.elowen.heroAnimator.moving);
 assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.pose(0).kind),'crouch','opposing movement keys do not walk');
 await page.keyboard.up('A');await page.evaluate(()=>window.elowen.x=1000);
 await page.waitForFunction(()=>!window.elowen.heroAnimator.moving);
 assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.pose(0).kind),'crouch','blocked movement at boundary holds crouch');
 await page.keyboard.up('D');await page.keyboard.up('S');await page.evaluate(()=>window.elowen.begin());
 assert(await page.evaluate(()=>!window.elowen.heroAnimator.moving&&window.elowen.heroAnimator.walkElapsed===0));
 assert.deepEqual(errors,[]);console.log('PASS: six crouched walking frames, loop, both directions, fixed scale/feet, 90px/s speed, pause, block/attack priority, stop/stand transitions, opposing keys, boundary and restart.');
} finally {await browser.close()}
