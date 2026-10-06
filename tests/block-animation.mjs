import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');
 await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.enemies=[];s.survivors=[];s.spawned=0;});
 assert(await page.evaluate(()=>window.elowen.heroAnimator.clips.block?.meta.frameCount===6));
 for(const face of [1,-1]) {
  await page.evaluate(face=>{const s=window.elowen;s.face=face;s.x=650;s.hp=100;s.stamina=100;s.heroAnimator.reset();},face);
  await page.keyboard.down('L');
  await page.waitForFunction(()=>window.elowen.heroAnimator.blockElapsed>=.4);
  const held=await page.evaluate(()=>{const s=window.elowen,im=s.spritePool.find(im=>im.visible&&im.getData('heroAction')==='block');return {frame:im.getData('heroFrame'),flip:im.flipX,scale:im.scaleY,y:im.y,feet:s.heroAnimator.clips.block.feet[5],origin:im.originY,height:im.frame.height}});
  assert.equal(held.frame,5,'block settles into a held brace');
  assert.equal(held.flip,face<0,'block mirrors with facing');
  assert(Math.abs(held.y+(held.feet-held.origin*held.height)*held.scale-422)<.01,'feet stay grounded');
  await page.evaluate(()=>{const s=window.elowen;s.enemies=[{x:s.x+s.face*30,hp:160,max:160,next:0,speed:0,kind:0}];});
  await page.waitForFunction(()=>window.elowen.heroAnimator.blockImpact!==null);
  assert.equal(await page.evaluate(()=>window.elowen.hp),100,'front block still prevents damage');
  assert(await page.evaluate(()=>window.elowen.stamina<100),'successful block still costs stamina');
  await page.waitForFunction(()=>window.elowen.heroAnimator.blockImpact===null);
  await page.evaluate(()=>window.elowen.enemies=[]);
  await page.keyboard.press('Escape');
  const frozen=await page.evaluate(()=>window.elowen.heroAnimator.blockElapsed);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.blockElapsed),frozen,'pause freezes block');
  await page.keyboard.press('Escape');
  await page.keyboard.up('L');
  await page.waitForFunction(()=>!window.elowen.heroAnimator.blocking);
  await page.keyboard.down('J');
  await page.waitForFunction(()=>window.elowen.heroAnimator.attack!==null);
  await page.keyboard.up('J');
  await page.waitForFunction(()=>window.elowen.heroAnimator.attack===null);
 }
 await page.keyboard.down('L');
 await page.waitForFunction(()=>window.elowen.heroAnimator.blocking);
 await page.evaluate(()=>{const s=window.elowen;s.stamina=0;s.shieldFlight={x:1200,y:377,dir:1,originX:650,returning:false,hits:new Set()};});
 await page.waitForFunction(()=>!window.elowen.heroAnimator.blocking);
 await page.keyboard.up('L');
 await page.evaluate(()=>window.elowen.begin());
 assert(await page.evaluate(()=>{const a=window.elowen.heroAnimator;return !a.blocking&&a.blockImpact===null&&a.blockElapsed===0}),'restart clears block state');
 assert.deepEqual(errors,[]);
 console.log('PASS: six block frames, held brace, impact from real enemy hit, left/right facing, grounded feet, unchanged defence and stamina cost, pause, release, sword recovery, unavailable shield and restart.');
} finally {await browser.close()}
