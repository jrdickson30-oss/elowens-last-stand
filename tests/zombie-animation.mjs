import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.evaluate(()=>{
 const s=window.elowen,e=s.enemies[0],im=s.spritePool.find(im=>im.visible&&im.getData('enemyGait')==='shuffle');
 return {x:e.x,elapsed:e.walkElapsed,frame:im?.frame.name,texture:im?.texture.key,flip:im?.flipX,scale:im?.scaleY,angle:im?.angle};
});
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.survivors=[];s.enemies=[{x:1150,hp:76,max:76,next:999,speed:50,kind:0,walkElapsed:0}]});
 await page.waitForFunction(()=>window.elowen.enemies[0].walkElapsed>.03);
 const initial=await state();assert.equal(initial.texture,'zombie-walk');assert.equal(initial.flip,true);assert.equal(initial.angle,0);
 const frames=await page.evaluate(async()=>{const seen=new Set();for(let i=0;i<36;i++){const s=window.elowen,im=s.spritePool.find(im=>im.visible&&im.getData('enemyGait')==='shuffle');seen.add(im.frame.name);await new Promise(r=>setTimeout(r,40))}return [...seen]});
 assert.equal(frames.length,6);assert.ok((await state()).x<initial.x);
 await page.screenshot({path:'zombie-walk-game.png'});
 await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
 const paused=await state();await page.waitForTimeout(180);assert.deepEqual(await state(),paused);
 await page.locator('#resume').click();
 for(const reason of ['stunned','rooted','wall','near']){
  await page.evaluate(reason=>{const s=window.elowen,e=s.enemies[0];e.x=1000;e.stunned=reason==='stunned'?10:0;e.rooted=reason==='rooted'?10:0;s.wall=reason==='wall'?{x:980,hp:100,max:100}:null;if(reason==='near')e.x=s.x+30},reason);
  await page.waitForTimeout(70);const stopped=await state();await page.waitForTimeout(160);const after=await state();
  assert.equal(after.elapsed,stopped.elapsed,reason+' freezes gait');assert.equal(after.frame,stopped.frame);
 }
 await page.evaluate(()=>{const s=window.elowen,e=s.enemies[0];s.wall=null;e.x=1000;e.stunned=e.rooted=0});
 await page.waitForTimeout(80);assert.ok((await state()).elapsed>paused.elapsed);
 const poses=await page.evaluate(()=>{
  const s=window.elowen,im=s.add.image(0,0,'characters'),results=[];let time=0;
  for(let frame=0;frame<6;frame++){for(const face of [-1,1]){s.zombieAnimator.render(im,500,422,(time+1)/1000,face);results.push({frame:im.frame.name,flip:im.flipX,scale:im.scaleY,feet:im.y,origin:im.originY})}time+=s.zombieAnimator.clip.durationsMs[frame]}im.destroy();return results;
 });
 poses.forEach((p,i)=>{assert.equal(p.frame,Math.floor(i/2));assert.equal(p.flip,i%2===0);assert.equal(p.scale,initial.scale);assert.equal(p.feet,422)});
 await page.evaluate(()=>{const s=window.elowen;s.enemies=[{x:1000,hp:60,max:60,next:999,speed:88,kind:1},{x:1120,hp:145,max:145,next:999,speed:32,kind:2}]});
 await page.waitForTimeout(80);
 assert.deepEqual(await page.evaluate(()=>window.elowen.spritePool.filter(im=>im.visible&&im.getData('heroAction')==='enemy').map(im=>im.texture.key)),['characters','characters']);
 assert.deepEqual(errors,[]);console.log('PASS: zombie shuffle, six frames, movement, pause, stun, roots, wall/contact stops, both directions, stable scale and other enemy types.');
}finally{await browser.close()}
