import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.evaluate(()=>{
 const s=window.elowen,e=s.enemies[0],im=s.spritePool.find(im=>im.visible&&im.getData('heroAction')==='enemy');
 return {hp:e?.hp,x:e?.x,time:e?.hitReaction?.elapsed,walk:e?.walkElapsed,texture:im?.texture.key,frame:im?.frame.name,flip:im?.flipX,angle:im?.angle,hit:im?.getData('enemyHit')};
});
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.survivors=[];s.enemies=[{x:s.x+65,hp:500,max:500,next:999,speed:0,kind:0,walkElapsed:.5}]});
 await page.keyboard.press('J');await page.waitForFunction(()=>window.elowen.enemies[0]?.hitReaction);
 const sword=await state();assert.ok(sword.hp<500);assert.equal(sword.texture,'zombie-hit');assert.equal(sword.hit,true);
 await page.keyboard.press('Escape');await page.locator('#resume').waitFor();const paused=await state();
 await page.waitForTimeout(160);assert.deepEqual(await state(),paused,'pause freezes recoil');
 // Inspect all six poses without allowing the game clock to skip a short impact frame.
 const poses=await page.evaluate(()=>{const s=window.elowen,e=s.enemies[0],clip=s.zombieAnimator.hitClip,results=[];let elapsed=0;
  for(let i=0;i<6;i++){e.hitReaction={elapsed:(elapsed+1)/1000,dir:1};s.draw();const im=s.spritePool.find(im=>im.visible&&im.getData('enemyHit'));results.push({frame:im.frame.name,scale:im.scaleY,feet:im.y});elapsed+=clip.durationsMs[i]}return results});
 assert.deepEqual(poses.map(p=>p.frame),[0,1,2,3,4,5]);assert.equal(new Set(poses.map(p=>p.scale)).size,1);assert.ok(poses.every(p=>p.feet===422));
 await page.evaluate(()=>{const s=window.elowen,e=s.enemies[0];e.x=1000;e.hitReaction={elapsed:.12,dir:1};s.draw()});
 await page.screenshot({path:'zombie-hit-game.png'});
 for(const kind of [0,1,2])for(const dir of [-1,1]){
  const hit=await page.evaluate(({kind,dir})=>{const s=window.elowen,e=s.enemies[0];e.kind=kind;e.x=1000;e.hp=500;e.hitReaction=undefined;s.hurt(e,10,dir);e.hitReaction.elapsed=.12;s.draw();const im=s.spritePool.find(im=>im.visible&&im.getData('enemyHit'));return {hp:e.hp,x:e.x,texture:im.texture.key,flip:im.flipX,angle:im.angle}}, {kind,dir});
  assert.equal(hit.hp,490);assert.equal(hit.x,1000+15*dir);
  if(kind===0){assert.equal(hit.texture,'zombie-hit');assert.equal(hit.flip,dir===1)}else{assert.equal(hit.texture,'characters');assert.equal(Math.sign(hit.angle),dir)}
 }
 const restarted=await page.evaluate(()=>{const s=window.elowen,e=s.enemies[0];e.kind=0;e.hitReaction={elapsed:.3,dir:1};s.hurt(e,1,-1);s.draw();const im=s.spritePool.find(im=>im.visible&&im.getData('enemyHit'));return {elapsed:e.hitReaction.elapsed,dir:e.hitReaction.dir,frame:im.frame.name}});
 assert.deepEqual(restarted,{elapsed:0,dir:-1,frame:0});
 await page.locator('#resume').click();await page.waitForFunction(()=>!window.elowen.enemies[0].hitReaction);assert.equal((await state()).texture,'zombie-walk');
 // Status effects freeze locomotion, but must not trap the Zombie in its hit pose.
 for(const status of ['stunned','rooted']){
  await page.evaluate(status=>{const s=window.elowen,e=s.enemies[0];e[status]=2;s.hurt(e,1,1)},status);
  await page.waitForFunction(()=>!window.elowen.enemies[0].hitReaction);assert.equal((await state()).texture,'zombie-walk');
 }
 await page.evaluate(()=>{const s=window.elowen,e=s.enemies[0];e.x=s.x+180;e.stunned=e.rooted=0;e.hp=500;s.energy=100;s.cast('ember')});
 await page.waitForFunction(()=>window.elowen.enemies[0].hp<500);assert.equal((await state()).texture,'zombie-hit');
 await page.waitForFunction(()=>!window.elowen.enemies[0].hitReaction);
 await page.evaluate(()=>{const s=window.elowen,e=s.enemies[0];e.x=1000;e.speed=50;s.hurt(e,1,1)});
 await page.waitForFunction(()=>!window.elowen.enemies[0].hitReaction);await page.waitForTimeout(80);assert.ok((await state()).walk>.5,'walking resumes after recoil');
 await page.evaluate(()=>{const s=window.elowen;s.hurt(s.enemies[0],99999,1)});await page.waitForFunction(()=>!window.elowen.enemies.length);
 assert.deepEqual(errors,[]);console.log('PASS: sword/spell recoil, six poses, pause, both impact directions, all enemy types, repeated hits, stun/root recovery, return to walk and lethal hits.');
}finally{await browser.close()}
