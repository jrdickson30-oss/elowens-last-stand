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
  const frames=await page.evaluate(async()=>{const seen=new Set();for(let i=0;i<30;i++){seen.add(window.elowen.heroAnimator.pose(0)?.frame);await new Promise(r=>setTimeout(r,40))}return [...seen]});
  assert.equal(frames.length,6);
  const pose=await page.evaluate(()=>{const s=window.elowen,im=s.spritePool.find(im=>im.visible&&['walk','guardWalk'].includes(im.getData('heroAction')));return {flip:im.flipX,scale:im.scaleY,kind:im.getData('heroAction')}});
  assert.equal(pose.flip,dir==='A');assert.equal(pose.kind,guarded?'guardWalk':'walk');
  await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
  const paused=await page.evaluate(()=>window.elowen.heroAnimator.walkElapsed);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.walkElapsed),paused);
  await page.keyboard.up(dir);if(guarded)await page.keyboard.up('L');await page.locator('#resume').click();
  await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)===null);
 }
 assert.deepEqual(errors,[]);console.log('PASS: both walking loops, six frames, both directions, pause and stop transitions.');
}finally{await browser.close()}
