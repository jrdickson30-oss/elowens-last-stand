import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.evaluate(()=>{
 const s=window.elowen,pair=s.corpsePool[0];
 return {count:s.corpses.length,time:s.corpses[0]?.elapsed,phase:s.phase,kills:s.kills,waveKills:s.waveKills,
  texture:pair?.body.texture.key,frame:pair?.body.frame.name,stage:pair?.body.getData('corpseStage'),alpha:pair?.body.alpha,
  nextVisible:pair?.next.visible,nextTexture:pair?.next.texture.key,nextAlpha:pair?.next.alpha};
});
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.survivors=[];s.enemies=[{x:s.x+65,hp:10,max:10,next:0,speed:0,kind:0,stunned:5,rooted:5},{x:1200,hp:500,max:500,next:999,speed:0,kind:0}];window.deathTarget=s.enemies[0];s.hurt(s.enemies[0],1,1)});
 assert.equal((await state()).count,0,'non-lethal damage only recoils');
 await page.keyboard.press('J');await page.waitForFunction(()=>window.elowen.corpses.length===1);
 const killed=await state();assert.equal(killed.texture,'zombie-fall');assert.equal(killed.kills,1);assert.equal(killed.waveKills,1);
 await page.waitForFunction(()=>window.elowen.enemies.length===1);
 await page.evaluate(()=>window.elowen.hurt(window.deathTarget,100,1));assert.equal((await state()).count,1);assert.equal((await state()).kills,1,'no duplicate deaths');
 await page.keyboard.press('Escape');await page.locator('#resume').waitFor();const paused=await state();await page.waitForTimeout(140);assert.deepEqual(await state(),paused);
 const poses=await page.evaluate(()=>{const s=window.elowen,c=s.corpses[0],clip=s.deathAnimator.fall,results=[];let time=0;
  for(let frame=0;frame<6;frame++){c.elapsed=(time+1)/1000;s.draw();const im=s.corpsePool[0].body;results.push({frame:im.frame.name,y:im.y,scale:im.scaleY});time+=clip.durationsMs[frame]}return results});
 assert.deepEqual(poses.map(p=>p.frame),[0,1,2,3,4,5]);assert.ok(poses.every(p=>p.y===422));assert.equal(new Set(poses.map(p=>p.scale)).size,1);
 for(const [time,stage] of [[.72,'settle'],[1.4,'decompose'],[2.3,'bones'],[3.9,'fade']]){
  await page.evaluate(time=>{const s=window.elowen;s.corpses[0].elapsed=time;s.draw()},time);const pose=await state();assert.equal(pose.stage,stage);
  if(stage==='decompose'){assert.equal(pose.texture,'zombie-decompose');assert.ok(pose.nextVisible);assert.ok(pose.nextAlpha>0&&pose.nextAlpha<1)}
  if(stage==='bones'){assert.equal(pose.frame,5);assert.equal(pose.alpha,1)}
  if(stage==='fade')assert.ok(pose.alpha>0&&pose.alpha<1);
 }
 // Capture fall, decomposition and bones together at the actual display size.
 await page.evaluate(()=>{const s=window.elowen;s.corpses=[{x:810,y:422,dir:1,kind:0,elapsed:.25},{x:1000,y:422,dir:1,kind:0,elapsed:1.35},{x:1170,y:422,dir:1,kind:0,elapsed:2.3}];s.draw()});
 await page.screenshot({path:'zombie-death-game.png'});
 // Check every enemy type and both impact directions, including an airborne kill.
 const variants=await page.evaluate(()=>{const s=window.elowen;const results=[];s.corpses=[];
  for(const kind of [0,1,2])for(const dir of [-1,1]){const e={x:1000,y:kind===0?302:422,hp:1,max:1,next:0,speed:0,kind};s.hurt(e,5,dir);const c=s.corpses.at(-1);c.elapsed=.35;s.draw();const pair=s.corpsePool.at(s.corpses.length-1);results.push({kind,dir,texture:pair.body.texture.key,flip:pair.body.flipX,angle:pair.body.angle,y:pair.body.y});c.elapsed=2.3;s.draw();results.at(-1).bonesTexture=(pair.next.visible?pair.next:pair.body).texture.key;}
  return results});
 variants.forEach(p=>{assert.equal(p.flip,p.dir>0);assert.equal(p.bonesTexture,'zombie-decompose');if(p.kind===0){assert.equal(p.texture,'zombie-fall');assert.equal(p.y,362)}else{assert.equal(p.texture,'characters');assert.equal(Math.sign(p.angle),p.dir)}});
 // A dead Zombie no longer participates in combat; wave transition waits for bones.
 await page.evaluate(()=>{const s=window.elowen;s.corpses=[{x:1000,y:422,dir:1,kind:0,elapsed:0}];s.enemies=[];s.spawned=s.total;s.survivors=[];s.hp=100});
 await page.locator('#resume').click();await page.waitForFunction(()=>window.elowen.corpses[0]?.elapsed>1);
 assert.equal((await state()).phase,'play');assert.equal(await page.evaluate(()=>window.elowen.hp),100);
 await page.waitForFunction(()=>window.elowen.phase==='wavebreak');assert.ok((await state()).time>=2.08);assert.equal((await state()).stage,'bones');
 await page.waitForFunction(()=>!window.elowen.corpses.length);assert.equal(await page.evaluate(()=>window.elowen.corpsePool.every(p=>!p.body.visible&&!p.next.visible)),true);
 await page.locator('#continue-wave').click();assert.equal(await page.evaluate(()=>window.elowen.wave),2);
 await page.evaluate(()=>{const s=window.elowen;s.hurt({x:1000,hp:1,max:1,next:0,speed:0,kind:0},10,1);s.begin()});
 assert.equal((await state()).count,0,'restart clears remains');
 assert.deepEqual(errors,[]);console.log('PASS: lethal sword damage, fall/decomposition/bones/fade, pause, grounded/airborne deaths, all types/directions, duplicate protection, wave timing, cleanup and restart.');
}finally{await browser.close()}
