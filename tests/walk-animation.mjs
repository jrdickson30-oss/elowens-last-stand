import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.enemies=[];s.survivors=[];});
 for(const guarded of [false,true])for(const dir of ['D','A']){
  await page.evaluate(()=>{const s=window.elowen;s.x=650;s.heroAnimator.reset()});
  if(guarded)await page.keyboard.down('L');await page.keyboard.down(dir);
  await page.waitForFunction(kind=>window.elowen.heroAnimator.pose(0)?.kind===kind,guarded?'guardWalk':'walk');
  const frames=await page.evaluate(async()=>{const seen=new Set();for(let i=0;i<30;i++){window.elowen.x=650;seen.add(window.elowen.heroAnimator.pose(0)?.frame);await new Promise(r=>setTimeout(r,40))}return [...seen]});
  assert.deepEqual(frames.sort((a,b)=>a-b),Array.from({length:guarded?6:8},(_,i)=>i));
  const pose=await page.evaluate(()=>{const s=window.elowen,im=s.spritePool.find(im=>im.visible&&['walk','guardWalk'].includes(im.getData('heroAction'))),clip=s.heroAnimator.clips[im.getData('heroAction')],frame=im.getData('heroFrame');return {flip:im.flipX,scale:im.scaleY,kind:im.getData('heroAction'),expectedScale:96/clip.meta.bodyHeight,foot:im.y+(clip.feet[frame]-im.originY*clip.meta.frameHeight)*im.scaleY}});
  assert.equal(pose.flip,dir==='A');assert.equal(pose.kind,guarded?'guardWalk':'walk');
  assert(Math.abs(pose.scale-pose.expectedScale)<.001,'body scale is fixed for the full clip');
  assert(Math.abs(pose.foot-422)<.01,'supporting foot stays at the physics ground');
  await page.evaluate(()=>window.elowen.x=650);
  const distance=await page.evaluate(()=>{const s=window.elowen,x=s.x;s.tick(.1);return Math.abs(s.x-x)});
  assert(Math.abs(distance-(guarded?9:21.5))<.01,'existing movement speed is preserved');
  await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
  const paused=await page.evaluate(()=>window.elowen.heroAnimator.walkElapsed);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.walkElapsed),paused);
  await page.keyboard.up(dir);if(guarded)await page.keyboard.up('L');await page.locator('#resume').click();
  await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)===null);
 }
 assert.deepEqual(errors,[]);console.log('PASS: eight normal / six guarded walk poses, both directions, grounded feet, fixed scale, movement speed, pause and stop transitions.');
}finally{await browser.close()}
