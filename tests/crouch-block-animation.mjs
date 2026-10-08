import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.enemies=[];s.survivors=[];s.spawned=0;});
 assert(await page.evaluate(()=>window.elowen.heroAnimator.clips.crouchBlock?.meta.frameCount===6));
 for(const face of [1,-1]) {
  await page.evaluate(face=>{const s=window.elowen;s.face=face;s.x=650;s.hp=100;s.stamina=100;s.heroAnimator.reset();},face);
  await page.keyboard.down('S');await page.keyboard.down('L');
  await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)?.kind==='crouchBlock'&&window.elowen.heroAnimator.blockElapsed>=.4);
  const held=await page.evaluate(()=>{const s=window.elowen,clip=s.heroAnimator.clips.crouchBlock,im=s.spritePool.find(i=>i.visible&&i.getData('heroAction')==='crouchBlock');return {frame:im.getData('heroFrame'),scale:im.scaleY,flip:im.flipX,foot:im.y+(clip.feet[5]-im.originY*512)*im.scaleY}});
  assert.equal(held.frame,5);assert.equal(held.flip,face<0);assert(Math.abs(held.scale-96/560)<.001);assert(Math.abs(held.foot-422)<.01);
  const startX=await page.evaluate(()=>window.elowen.x);
  await page.keyboard.down('D');await page.waitForFunction(x=>window.elowen.x>x+5,startX);
  assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.pose(0).kind),'crouchBlock','moving crouched does not select standing guard walk');
  await page.keyboard.up('D');await page.evaluate(face=>window.elowen.face=face,face);
  await page.evaluate(()=>{const s=window.elowen;s.enemies=[{x:s.x+s.face*30,hp:160,max:160,next:0,speed:0,kind:0}];});
  await page.waitForFunction(()=>window.elowen.heroAnimator.blockImpact!==null);
  assert.equal(await page.evaluate(()=>window.elowen.hp),100);assert(await page.evaluate(()=>window.elowen.stamina<100));
  assert(await page.evaluate(()=>[3,4].includes(window.elowen.heroAnimator.pose(0).frame)),'real blocked hit triggers recoil');
  await page.waitForFunction(()=>window.elowen.heroAnimator.blockImpact===null);
  await page.evaluate(()=>{const s=window.elowen;s.enemies=[];s.paused=true;});
  const frames=await page.evaluate(()=>{
   const s=window.elowen,a=s.heroAnimator,c=a.clips.crouchBlock;
   return [0,1,2,3,4,5].map(frame=>{a.blockElapsed=[0,.1,.2,.4,.4,.4][frame];a.blockImpact=frame===3?.01:frame===4?.1:null;s.draw();const im=s.spritePool.find(i=>i.visible&&i.getData('heroAction')==='crouchBlock');return {frame:im.getData('heroFrame'),scale:im.scaleY,foot:im.y+(c.feet[frame]-im.originY*512)*im.scaleY}});
  });
  assert.deepEqual(frames.map(f=>f.frame),[0,1,2,3,4,5]);assert(frames.every(f=>f.scale===held.scale&&Math.abs(f.foot-422)<.01));
  await page.screenshot({path:`crouch-block-${face}.png`});
  await page.evaluate(()=>window.elowen.paused=false);
  await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
  const frozen=await page.evaluate(()=>window.elowen.heroAnimator.blockElapsed);await page.waitForTimeout(120);
  assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.blockElapsed),frozen);
  await page.locator('#resume').click();
  await page.keyboard.up('S');await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)?.kind==='block');
  await page.keyboard.down('S');await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)?.kind==='crouchBlock');
  await page.keyboard.up('L');await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)?.kind==='crouch');
  await page.keyboard.down('J');await page.waitForFunction(()=>window.elowen.heroAnimator.attack?.kind==='crouchSlash');await page.keyboard.up('J');
  await page.waitForFunction(()=>window.elowen.heroAnimator.attack===null);
  await page.keyboard.up('S');await page.waitForFunction(()=>window.elowen.heroAnimator.crouchProgress===0);
 }
 await page.evaluate(()=>window.elowen.begin());assert(await page.evaluate(()=>!window.elowen.heroAnimator.crouching&&!window.elowen.heroAnimator.blocking));
 assert.deepEqual(errors,[]);console.log('PASS: six crouching block frames, fixed scale/feet, both directions, moving crouched, real hit recoil, defence/stamina, pause, standing block, crouch recovery, sword and restart.');
} finally {await browser.close()}
