import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.soundAudit={loaded:[],played:[],peak:0,failures:[]};
  const load=HTMLMediaElement.prototype.load,play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.load=function(){window.soundAudit.loaded.push(this);return load.call(this)};
  HTMLMediaElement.prototype.play=function(){
   window.soundAudit.played.push(this);
   const result=play.call(this);
   window.soundAudit.peak=Math.max(window.soundAudit.peak,new Set(window.soundAudit.played.filter(sound=>!sound.paused&&!sound.ended)).size);
   result.catch(error=>{if(error.name!=='AbortError')window.soundAudit.failures.push(error.message)});
   return result;
  };
 });
 let release;
 const held=new Promise(resolve=>{release=resolve});
 await page.route('**/audio/fantasy-spells/*Dagger*',async route=>{await held;await route.continue()});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.locator('#begin').click({timeout:90000});
 await page.evaluate(()=>{const s=window.elowen;s.game.loop.sleep();s.enemies=[];s.survivors=[];s.timer=999});
 await page.locator('#sound').click();
 await page.evaluate(()=>{const s=window.elowen;s.touch.add('J');s.tick(.01);s.touch.clear()});
 assert.equal(await page.evaluate(()=>window.soundAudit.played.length),0,'a sound still downloading is skipped');
 release();await page.waitForFunction(()=>window.soundAudit.loaded.length===57&&window.soundAudit.loaded.every(sound=>sound.readyState===4),{},{timeout:60000});
 await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.soundAudit.played.length),0,'finishing a download cannot replay an old attack');
 await page.evaluate(()=>{const s=window.elowen;s.attackCd=0;s.touch.add('J');s.tick(.01);s.touch.clear()});
 await page.waitForFunction(()=>window.soundAudit.played.length>0);await page.waitForTimeout(450);
 const quiet=()=>page.evaluate(()=>window.soundAudit.loaded.every(sound=>sound.paused||sound.ended));
 assert(await quiet(),'short sword effects expire without scene updates');
 await page.evaluate(()=>{
  const s=window.elowen;s.blocking=true;s.stamina=10000;s.face=1;
  for(let i=0;i<30;i++)s.zombieHeroHit({x:s.x+20,hp:100,max:100,next:999,speed:0,kind:2});
 });
 assert(await page.evaluate(()=>new Set(window.soundAudit.played.filter(sound=>!sound.paused&&!sound.ended)).size<=1),'thirty impacts share one voice');
 await page.waitForTimeout(350);assert(await quiet(),'impact tails end within the interaction window');
 await page.evaluate(()=>{
  const s=window.elowen;s.hp=10000;s.stamina=10000;s.blocking=false;s.inv=0;
  s.startZombieClaw({x:s.x+30,hp:100,max:100,next:0,speed:0,kind:2},{kind:'hero'},s.x);
  s.hurt({x:s.x+40,hp:1,max:1,next:999,speed:0,kind:0},10);
  s.zombieHeroHit({x:s.x+30,hp:100,max:100,next:999,speed:0,kind:2});
  s.pendingEmber={delay:0,face:1,damage:43};s.tickEmber(.01);
  s.explodeIce({x:s.x+200,y:378,dir:1,spell:'ice',life:0,damage:48});
  s.heroAnimator.reset();s.attackCd=0;s.touch.add('D');s.touch.add('J');s.tick(.01);s.touch.clear();
 });
 assert(await page.evaluate(()=>window.soundAudit.peak<=6),'mixed combat never exceeds six simultaneous voices');
 await page.waitForTimeout(1100);assert(await quiet(),'combat leaves no long tails or queued playback');
 await page.evaluate(()=>{const s=window.elowen;s.footstepTime=0;s.touch.add('D');s.tick(.3);s.touch.clear();s.tick(.01)});
 assert(await page.evaluate(()=>window.soundAudit.loaded.filter(sound=>sound.src.includes('footstep_')).every(sound=>sound.paused)),'releasing movement stops the footstep');
 const impact=()=>page.evaluate(()=>{const s=window.elowen;s.blocking=true;s.face=1;s.stamina=100;s.zombieHeroHit({x:s.x+20,hp:100,max:100,next:999,speed:0,kind:2})});
 await impact();await page.evaluate(()=>{const s=window.elowen;s.paused=true;s.update(0,16)});assert(await quiet(),'pause stops active voices immediately');
 await page.evaluate(()=>{window.elowen.paused=false;window.elowen.update(0,16)});assert(await quiet(),'resume does not replay old voices');
 for(const transition of ['startWave','beginEnding','end','begin']){
  await page.evaluate(()=>window.elowen.begin());await impact();
  await page.evaluate(transition=>window.elowen[transition](false),transition);
  assert(await quiet(),`${transition} clears all previous effects`);
 }
 await impact();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert(await quiet(),'leaving the window stops audio');
 const before=await page.evaluate(()=>window.soundAudit.played.length);await impact();
 assert.equal(await page.evaluate(()=>window.soundAudit.played.length),before,'background interactions cannot queue sounds');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert(await quiet(),'returning to the window stays quiet');
 await impact();await page.locator('#sound').click();assert(await quiet(),'mute stops the final voice');
 await page.locator('#sound').click();assert.equal(await page.evaluate(()=>window.soundAudit.loaded.length),57,'unmuting reuses the loaded clips');assert(await quiet());
 assert.deepEqual(await page.evaluate(()=>window.soundAudit.failures),[]);assert.deepEqual(errors,[]);
 console.log('PASS: no delayed sound queue, cached clips, capped overlap, short effect tails, movement release, pause/resume, wave/end/restart cleanup, background silence and mute.');
} finally {await browser.close()}
