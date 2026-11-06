import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.GAME_URL);await page.locator('#begin').click({timeout:90000});
 for(const face of [-1,1])for(const crouch of [false,true]){
  const result=await page.evaluate(({face,crouch})=>{
   const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.enemies=[];s.survivors=[];s.x=650;s.y=422;s.face=face;s.crouching=crouch;s.upgrades=['ice'];
   s.cast('ice');if(!s.heroAnimator.casting)throw new Error(JSON.stringify({face,crouch,message:s.message,block:s.blocking,clip:!!s.heroAnimator.clips.ice}));const energy=s.energy,cooldown=s.spellCooldowns.ice,initial=s.shots.length;
   const samples=[];
   for(const time of [.001,.081,.181,.341,.481,.781,1.141,1.241]){
    s.heroAnimator.casting.elapsed=time;s.draw();const im=s.spritePool.find(im=>im.visible&&im.getData('heroAction')==='ice');
    samples.push({frame:im.getData('heroFrame'),flip:im.flipX,x:im.scaleX,y:im.scaleY,foot:im.y+(s.heroAnimator.clips.ice.feet[im.getData('heroFrame')]-im.originY*512)*im.scaleY});
   }
   s.heroAnimator.casting.elapsed=0;s.face=-face;s.tickIce(.339);const before=s.shots.length;
   s.tickIce(.001);const shot={...s.shots[0]},muzzle=s.heroAnimator.iceMuzzle(s.x,s.y,face,crouch);
   s.tickIce(.2);const count=s.shots.length;s.cast('ice');const message=s.message;
   return {energy,cooldown,initial,before,shot,muzzle,count,samples,message,delay:s.heroAnimator.iceReleaseDelay(),beam:s.iceLance.beams.length};
  },{face,crouch});
  assert.equal(result.energy,68);assert.equal(result.cooldown,3);assert.equal(result.delay,.34);
  assert.equal(result.initial,0);assert.equal(result.before,0);assert.equal(result.count,1);assert.equal(result.beam,1);
  assert.equal(result.shot.dir,face);assert.equal(result.shot.damage,48);assert.equal(result.shot.life,.8);
  assert.equal(result.shot.x,result.muzzle.x);assert.equal(result.shot.y,result.muzzle.y);
  assert.deepEqual(result.samples.map(sample=>sample.frame),[0,1,2,3,4,5,6,7]);
  assert(result.samples.every(sample=>sample.flip===(face<0)&&Math.abs(sample.foot-422)<.01&&Math.abs(sample.x-96/400)<.001&&Math.abs(sample.y/sample.x-(crouch?.65:1))<.001));
  assert.equal(result.message,'Ice Lance is recharging.');
 }
 for(const face of [-1,1])for(const dt of [.01,.04]){
  const result=await page.evaluate(({face,dt})=>{
   const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.enemies=[];s.survivors=[];s.x=face<0?1000:400;s.face=face;s.upgrades=['ice'];
   const targets=[160,200,-70,700].map(dx=>({x:s.x+face*dx,hp:160,max:160,next:999,speed:0,kind:0}));s.enemies=targets;s.cast('ice');
   let firstHit=null,maxBeams=0,maxImpacts=0;
   for(let elapsed=0;elapsed<2.5;elapsed+=dt){s.tick(dt);s.heroAnimator.tick(dt,s.y,422,false,true);s.draw();maxBeams=Math.max(maxBeams,s.iceLance.beams.length);maxImpacts=Math.max(maxImpacts,s.iceLance.impacts.length);if(targets[0].hp<160&&firstHit===null)firstHit=elapsed;}
   return {hp:targets.map(target=>target.hp),firstHit,maxBeams,maxImpacts,active:s.iceLance.active,impacts:s.iceLance.impacts.length,casting:s.heroAnimator.casting,shots:s.shots.length};
  },{face,dt});
  assert.deepEqual(result.hp,[78,126,160,160],'48 direct + 34 splash once; nearby target receives splash only');
  assert(result.firstHit>.34);assert.equal(result.maxBeams,1);assert.equal(result.maxImpacts,1);
  assert(!result.active&&!result.impacts&&!result.casting&&!result.shots,'all casting and effect state expires');
 }
 const miss=await page.evaluate(()=>{
  const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.survivors=[];s.x=500;s.upgrades=['ice'];
  const enemy={x:1060,hp:160,max:160,next:999,speed:0,kind:0};s.enemies=[enemy];s.cast('ice');
  for(let i=0;i<90;i++){s.tick(.02);s.heroAnimator.tick(.02,s.y,422,false,true);s.draw()}
  return enemy.hp;
 });assert.equal(miss,126,'beam still explodes at maximum range on a miss');
 const splash=await page.evaluate(()=>{
  const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.survivors=[];
  const targets=[0,104,106,-104,-106].map(dx=>({x:650+dx,hp:160,max:160,next:999,speed:0,kind:0}));s.enemies=targets;
  s.explodeIce({x:650,y:378,dir:1,life:0,spell:'ice',damage:48});
  const initial=targets.map(target=>target.hp);s.tickIce(.3);s.draw();
  const mist=s.iceLance.mistPool.filter(image=>image.visible);
  return {initial,after:targets.map(target=>target.hp),mist:mist.length,spread:Math.max(...mist.map(image=>image.getBounds().right))-Math.min(...mist.map(image=>image.getBounds().left)),active:s.iceLance.active};
 });
 assert.deepEqual(splash.initial,[126,126,160,126,160],'splash reaches both sides inside 105px and excludes targets outside');
 assert.deepEqual(splash.after,splash.initial,'decorative shards and mist do not add damage');
 assert(splash.mist>=8&&splash.spread>150&&splash.active,'frost cloud fills the splash area after the initial flash');
 const impactPause=await page.evaluate(()=>({ages:window.elowen.iceLance.impacts.map(impact=>impact.age),mist:window.elowen.iceLance.mistPool.map(image=>({x:image.x,y:image.y,alpha:image.alpha}))}));
 await page.waitForTimeout(120);
 assert.deepEqual(await page.evaluate(()=>({ages:window.elowen.iceLance.impacts.map(impact=>impact.age),mist:window.elowen.iceLance.mistPool.map(image=>({x:image.x,y:image.y,alpha:image.alpha}))})),impactPause,'pause freezes expanding frost and crystals');
 const fade=await page.evaluate(()=>{
  const s=window.elowen,samples=[];
  for(const age of [.3,.55,.8,1.05,1.3,1.55,1.64,1.67]){
   const current=s.iceLance.impacts[0]?.age??1.67;
   s.tickIce(Math.max(0,age-current));s.draw();
   samples.push({age,alpha:s.iceLance.mistPool.reduce((sum,image)=>sum+(image.visible?image.alpha:0),0),visible:s.iceLance.mistPool.filter(image=>image.visible).length,active:s.iceLance.active});
  }
  return samples;
 });
 assert(fade[3].visible>0&&fade[3].alpha<fade[0].alpha*.6,'mist remains as a thinning tail after the crystal burst');
 assert(fade.every((sample,i)=>i===0||sample.alpha<=fade[i-1].alpha),'mist opacity decreases continuously through the tail');
 assert(fade[5].alpha<fade[0].alpha*.02&&fade[6].alpha<fade[0].alpha*.001,'mist is almost transparent before removal');
 assert(!fade.at(-1).active&&!fade.at(-1).visible,'the complete fade leaves no effects behind');
 // Check real rendered opacity: a ground mask previously kept every wisp at
 // full brightness in Canvas even while its Image.alpha approached zero.
 await page.evaluate(()=>{
  const s=window.elowen,image=s.iceLance.mistPool[0];s.scene.pause();
  s.data.set('iceOpacityCheck',{image,background:s.cameras.main.backgroundColor.color,visibility:s.children.list.map(object=>({object,visible:object.visible}))});
  s.children.list.forEach(object=>object.setVisible(false));s.cameras.main.setBackgroundColor('#000000');
  image.setPosition(650,200).setDisplaySize(100,100).setVisible(true);
 });
 const pixels=[];
 for(const alpha of [.8,.4,.2,.05])pixels.push(await page.evaluate(alpha=>new Promise(resolve=>{
  const s=window.elowen;s.data.get('iceOpacityCheck').image.setAlpha(alpha);
  s.game.renderer.snapshotPixel(650,200,color=>resolve(color.blue));
 }),alpha));
 assert(pixels[1]<pixels[0]*.7&&pixels[2]<pixels[1]*.7&&pixels[3]<pixels[0]*.12,'actual mist pixels fade with sprite opacity');
 await page.evaluate(()=>{const s=window.elowen,check=s.data.get('iceOpacityCheck');check.visibility.forEach(({object,visible})=>object.setVisible(visible));s.cameras.main.setBackgroundColor(check.background);s.data.remove('iceOpacityCheck');s.scene.resume()});
 await page.evaluate(()=>{const s=window.elowen;s.begin();s.paused=true;s.upgrades=['ice'];s.cast('ice')});
 const frozen=await page.evaluate(()=>({delay:window.elowen.iceLance.pending.delay,elapsed:window.elowen.heroAnimator.casting.elapsed}));
 await page.waitForTimeout(120);assert.deepEqual(await page.evaluate(()=>({delay:window.elowen.iceLance.pending.delay,elapsed:window.elowen.heroAnimator.casting.elapsed})),frozen);
 for(const reset of ['startWave','beginEnding','end','begin']){
  assert(await page.evaluate(reset=>{const s=window.elowen;s.begin();s.paused=true;s.upgrades=['ice'];s.cast('ice');s.tickIce(.34);s.iceLance.impact(s.shots[0]);s.draw();s[reset](false);return !s.iceLance.active&&!s.iceLance.impacts.length&&!s.iceLance.mistPool.some(image=>image.visible)},reset),'scene transition clears ice charge, beam, impacts and mist');
 }
 assert(await page.evaluate(()=>{const s=window.elowen;s.begin();s.paused=true;s.cast('ice');return s.energy===100&&!s.iceLance.active}),'locked cast is blocked');
 assert(await page.evaluate(()=>{const s=window.elowen;s.upgrades=['ice'];s.energy=0;s.cast('ice');return !s.iceLance.active}),'insufficient energy is blocked');
 assert(await page.evaluate(()=>{const s=window.elowen;s.energy=100;s.blocking=true;s.cast('ice');return s.energy===100&&!s.iceLance.active}),'normal block restriction remains');
 assert.deepEqual(errors,[]);
 console.log('PASS: shield/frost poses and beam, damage/splash boundary, gradual staggered mist fade, pause, cleanup and cast gates.');
} finally {await browser.close()}
