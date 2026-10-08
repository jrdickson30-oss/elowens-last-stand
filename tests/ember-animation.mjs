import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL);await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.paused=true;s.timer=999;s.enemies=[];s.survivors=[];s.spawned=0});
 for(const face of [1,-1])for(const crouching of [false,true]){
  const result=await page.evaluate(({face,crouching})=>{
   const s=window.elowen,a=s.heroAnimator;s.x=650;s.y=422;s.face=face;s.crouching=crouching;s.blocking=false;s.energy=100;s.spellCooldowns={};s.shots=[];a.reset();s.cast('ember');
   const cost=s.energy,cooldown=s.spellCooldowns.ember,initial=s.shots.length;
   s.tickEmber(.119);const before=s.shots.length;s.tickEmber(.001);
   const shot={...s.shots[0]},tip=a.emberTip(s.x,s.y,face,crouching);s.tickEmber(.5);
   const samples=[];for(const elapsed of [0,.041,.081,.121,.181,.261]){a.casting.elapsed=elapsed;s.draw();const im=s.spritePool.find(i=>i.visible&&i.getData('heroAction')==='ember');samples.push({frame:im.getData('heroFrame'),flip:im.flipX,scaleX:im.scaleX,scaleY:im.scaleY,foot:im.y+(a.clips.ember.feet[im.getData('heroFrame')]-im.originY*512)*im.scaleY})}
   s.cast('ember');const message=s.message;
   a.casting.fresh=false;a.tick(.4,s.y,422,false,true,false,crouching);
   return {cost,cooldown,initial,before,shot,tip,count:s.shots.length,samples,message,ended:!a.casting};
  },{face,crouching});
  assert.equal(result.cost,76);assert.equal(result.cooldown,.75);assert.equal(result.initial,0);assert.equal(result.before,0);assert.equal(result.count,1);
  assert.equal(result.shot.damage,43);assert.equal(result.shot.dir,face);assert.equal(result.shot.x,result.tip.x);assert.equal(result.shot.y,result.tip.y);
  assert.deepEqual(result.samples.map(s=>s.frame),[0,1,2,3,4,5]);assert(result.samples.every(s=>s.flip===(face<0)&&Math.abs(s.foot-422)<.01&&Math.abs(s.scaleX-96/386)<.001));
  assert.equal(result.message,'Ember Strike is recharging.');assert(result.ended);
 }
 await page.evaluate(()=>{const s=window.elowen;s.crouching=false;s.face=1;s.heroAnimator.reset();s.energy=100;s.spellCooldowns={};s.shots=[];s.cast('ember');s.heroAnimator.casting.elapsed=.09;s.draw()});
 await page.screenshot({path:'ember-strike-preview.png'});
 const frozen=await page.evaluate(()=>({delay:window.elowen.pendingEmber.delay,elapsed:window.elowen.heroAnimator.casting.elapsed}));await page.waitForTimeout(160);
 assert.deepEqual(await page.evaluate(()=>({delay:window.elowen.pendingEmber.delay,elapsed:window.elowen.heroAnimator.casting.elapsed})),frozen);
 await page.evaluate(()=>window.elowen.begin());assert(await page.evaluate(()=>!window.elowen.pendingEmber&&!window.elowen.heroAnimator.casting));
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.spawned=0;s.survivors=[];s.enemies=[{x:800,hp:100,max:100,next:999,speed:0,kind:0}];s.x=650;s.energy=100;});
 await page.keyboard.press('E');await page.waitForFunction(()=>window.elowen.enemies[0]?.hp===57);
 assert.deepEqual(errors,[]);console.log('PASS: six casting frames, full sword scale, mirrored tip release, crouching, 120ms charge, single bolt, cost/cooldown/damage, pause and restart.');
}finally{await browser.close()}
