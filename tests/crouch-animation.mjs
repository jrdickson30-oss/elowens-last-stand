import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.enemies=[];s.survivors=[];});
 for(const face of [1,-1]){
  await page.evaluate(face=>{window.elowen.face=face;window.elowen.heroAnimator.reset()},face);
  await page.keyboard.down('S');await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)?.frame===5);
  const held=await page.evaluate(()=>{const s=window.elowen,c=s.heroAnimator.clips.crouch,im=s.spritePool.find(i=>i.visible&&i.getData('heroAction')==='crouch');return {frame:im.getData('heroFrame'),flip:im.flipX,scale:im.scaleY,expected:c.scale,y:im.y,origin:im.originY,expectedOrigin:c.feet[5]/c.meta.frameHeight}});
  assert.equal(held.flip,face<0);assert.equal(held.scale,held.expected,'crouch bends without shrinking sprite');assert.equal(held.y,422);assert.equal(held.origin,held.expectedOrigin);
  await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.pose(0).frame),5,'hold low pose');
  await page.keyboard.press('Escape');await page.locator('#resume').waitFor();const progress=await page.evaluate(()=>window.elowen.heroAnimator.crouchProgress);
  await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.crouchProgress),progress);
  await page.locator('#resume').click();await page.keyboard.up('S');
  await page.waitForFunction(()=>window.elowen.heroAnimator.crouchProgress>0&&window.elowen.heroAnimator.pose(0)?.frame<5);
  await page.waitForFunction(()=>window.elowen.heroAnimator.pose(0)===null);
 }
 const samples=await page.evaluate(()=>{const s=window.elowen,clip=s.heroAnimator.clips.crouch;return Array.from({length:6},(_,frame)=>{s.heroAnimator.crouchProgress=Math.min(.4,(frame+.1)*.08);s.draw();const im=s.spritePool.find(i=>i.visible&&i.getData('heroAction')==='crouch');return {frame:im.getData('heroFrame'),scale:im.scaleY,y:im.y}})});
 assert.deepEqual(samples.map(s=>s.frame),[0,1,2,3,4,5]);assert(samples.every(s=>s.scale===heldScale(samples)&&s.y===422));
 await page.evaluate(()=>window.elowen.begin());assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.crouchProgress),0);
 assert.deepEqual(errors,[]);console.log('PASS: six crouch poses, low hold, reverse stand, both directions, fixed scale/ground, pause and restart.');
}finally{await browser.close()}
function heldScale(samples){return samples[0].scale}
