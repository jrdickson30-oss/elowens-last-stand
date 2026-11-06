import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.GAME_URL);await page.locator('#begin').click({timeout:90000});
 assert(await page.evaluate(()=>window.elowen.textures.exists('elowen-thrown-shield')&&['shieldThrow','unshieldedWalk','unshieldedSword','unshieldedUtility'].every(kind=>!!window.elowen.heroAnimator.clips[kind])),'throw, shield and shieldless atlases load');
 for(const face of [-1,1])for(const dt of [.01,.04])for(const rank of [1,3]){
  const result=await page.evaluate(({face,dt,rank})=>{
   const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.survivors=[];s.x=face>0?420:1000;s.face=face;s.stamina=100;s.shieldAbility='throw';s.upgrades=['throw'];s.abilityRanks.throw=rank;
   const targets=[120,260,-80,520].map(dx=>({x:s.x+face*dx,hp:1000,max:1000,next:999,speed:0,kind:0}));s.enemies=targets;
   s.activateAbilityKey('K');const flight=s.shieldFlight,cost=s.stamina;s.activateAbilityKey('K');const same=s.shieldFlight===flight&&s.stamina===cost;
   s.touch.add('L');let firstVisible=null,maxRange=0,rotated=false,sawReturn=false,sawCatch=false,sawEmpty=false,badCopy=false,grounded=true;
   const phases=new Set();
   for(let elapsed=0;elapsed<2.8;elapsed+=dt){
    s.tick(dt);s.heroAnimator.tick(dt,s.y,422,s.blocking,true);s.draw();
    const f=s.shieldFlight,im=s.spritePool.find(image=>image.visible&&(image.texture.key.startsWith('hero-')||image.texture.key==='elowen-idle'));
    if(f){
     maxRange=Math.max(maxRange,Math.abs(f.x-f.originX));sawReturn||=f.returning;
     if(s.shieldThrow.image.visible&&firstVisible===null)firstVisible=elapsed+dt;
     rotated||=Math.abs(s.shieldThrow.image.rotation)>.3;
     if(f.released){
      const kind=im?.getData('heroAction'),frame=im?.getData('heroFrame');
      badCopy||=!s.heroAnimator.shieldAway||!['unshieldedWalk','unshieldedSword','unshieldedUtility','shieldThrow'].includes(kind)||(kind==='shieldThrow'&&(frame<3||frame>5));
      sawEmpty||=kind==='unshieldedUtility';
     }
    }else if(im?.getData('heroAction')==='shieldThrow'&&im.getData('heroFrame')>=6)sawCatch=true;
    if(im){const kind=im.getData('heroAction'),frame=im.getData('heroFrame'),clip=s.heroAnimator.clips[kind];if(kind==='shieldThrow')phases.add(frame);if(clip)grounded&&=Math.abs(im.y+(clip.feet[frame]-im.originY*clip.meta.frameHeight)*im.scaleY-422)<.01;}
   }
   return {cost,same,firstVisible,maxRange,rotated,sawReturn,sawCatch,sawEmpty,badCopy,grounded,phases:[...phases],hp:targets.map(enemy=>enemy.hp),damage:35+10*(rank-1)+s.progression.shieldDamageBonus,hits:flight.hits.size,ended:!s.shieldFlight&&!s.heroAnimator.shieldAway&&!s.shieldThrow.image.visible&&!s.shieldThrow.ghosts.some(image=>image.visible),blocking:s.blocking,cooldown:s.abilityCooldowns.throw??0};
  },{face,dt,rank});
  assert.equal(result.cost,75);assert(result.same,'second throw cannot spend stamina or create another shield');
  assert(result.firstVisible>=.239&&result.firstVisible<.29,'projectile appears at the animated release');
  assert(Math.abs(result.maxRange-(320+60*(rank-1)))<.01,'rank-scaled flight range is preserved');
  assert.deepEqual(result.hp,[1000-result.damage,1000-result.damage,1000,1000]);assert.equal(result.hits,2,'each target is hit only once across both legs of the flight');
  assert(result.rotated&&result.sawReturn&&result.sawCatch&&result.sawEmpty&&result.grounded&&!result.badCopy);
  assert([0,1,2,3,4,5,6,7].every(frame=>result.phases.includes(frame)),'wind-up, release, follow-through and catch poses all play');
  assert(result.ended&&result.blocking&&result.cooldown===0,'catch restores the shield and blocking without adding a cooldown');
 }
 // Catch follows a moving/jumping heroine, whose sword remains usable in flight.
 const moving=await page.evaluate(()=>{
  const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.survivors=[];s.enemies=[];s.x=500;s.shieldAbility='throw';s.upgrades=['throw','ice'];s.activateAbilityKey('K');
  const step=()=>{s.tick(.02);s.heroAnimator.tick(.02,s.y,422,s.blocking,true,s.down('D'));s.draw()};
  for(let i=0;i<28;i++)step();
  const enemy={x:s.x+60,hp:1000,max:1000,next:999,speed:0,kind:0};s.enemies=[enemy];s.touch.add('D');s.touch.add('J');let sword=false,jump=false;
  for(let i=0;i<10;i++){step();sword||=s.spritePool.some(image=>image.visible&&image.getData('heroAction')==='unshieldedSword');}
  s.touch.delete('J');s.touch.add('W');step();s.touch.delete('W');
  s.energy=100;s.cast('ice');const iceBlocked=s.energy===100&&s.message==='Wait for your shield to return.';
  for(let i=0;i<110;i++){step();jump||=s.y<410;}
  s.touch.clear();s.stamina=100;s.activateAbilityKey('K');const repeated=!!s.shieldFlight&&s.stamina===75;
  return {sword,jump,moved:s.x>530,hp:enemy.hp,expected:1000-s.damage,iceBlocked,repeated};
 });
 assert(moving.sword&&moving.jump&&moving.moved&&moving.iceBlocked&&moving.repeated);assert.equal(moving.hp,moving.expected,'sword damage still works while the shield is away');
 // Every action that can run during flight must render an empty left hand.
 const variants=await page.evaluate(()=>{
  const s=window.elowen;s.begin();s.paused=true;s.enemies=[];s.survivors=[];s.x=650;const a=s.heroAnimator,result=[];
  const draw=()=>{s.draw();const image=s.spritePool.find(image=>image.visible),bounds=image.getBounds();return {kind:image.getData('heroAction'),centre:{x:bounds.centerX,y:bounds.centerY}}};
  for(const state of ['idle','walk','crouch','crouchWalk','slash','thrust','crouchSlash','rise','fall','ember','stone','radiant','spin','dive']){
   a.reset();a.shieldAway=true;s.crouching=false;s.vy=0;
   if(state==='walk'){a.moving=true;a.walkElapsed=.15;}
   if(state==='crouch'||state==='crouchWalk'){a.crouching=true;a.crouchProgress=.4;a.moving=state==='crouchWalk';s.crouching=true;}
   if(['slash','thrust','crouchSlash'].includes(state)){if(state==='thrust')a.nextAttack='thrust';a.startAttack(115,1,false,state==='crouchSlash');a.attack.elapsed=.2;}
   if(state==='rise'||state==='fall'){a.airborne=true;s.vy=state==='rise'?-200:200;}
   if(state==='ember')a.startEmber(1);if(state==='stone')a.startStone(1);if(state==='radiant')a.startRadiant(1);
   if(state==='spin')a.startRising({elapsed:.2,face:1,extended:false});
   if(state==='dive')a.startAerial({kind:'dive',elapsed:.2,face:1,extended:false,landingElapsed:null});
   result.push({state,...draw()});
  }
  return result;
 });
 assert(variants.every(sample=>sample.kind.startsWith('unshielded')||(['stone','radiant'].includes(sample.state)&&sample.kind==='shieldThrow')),'no shield-bearing idle/walk/combat atlas is reused during flight');
 assert(Math.hypot(variants.find(sample=>sample.state==='spin').centre.x-650,variants.find(sample=>sample.state==='spin').centre.y-374)<35,'shieldless airborne spins rotate around her body');
 await page.evaluate(()=>{const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.enemies=[];s.survivors=[];s.shieldAbility='throw';s.upgrades=['throw'];s.activateAbilityKey('K');s.tickShieldThrow(.4);s.heroAnimator.tick(.4,s.y,422,false,true);s.draw()});
 const frozen=await page.evaluate(()=>({x:window.elowen.shieldFlight.x,y:window.elowen.shieldFlight.y,angle:window.elowen.shieldFlight.angle,pose:window.elowen.heroAnimator.shieldAction?.elapsed}));
 await page.waitForTimeout(120);assert.deepEqual(await page.evaluate(()=>({x:window.elowen.shieldFlight.x,y:window.elowen.shieldFlight.y,angle:window.elowen.shieldFlight.angle,pose:window.elowen.heroAnimator.shieldAction?.elapsed})),frozen);
 for(const reset of ['startWave','beginEnding','end','begin'])assert(await page.evaluate(reset=>{const s=window.elowen;s.begin();s.paused=true;s.shieldAbility='throw';s.upgrades=['throw'];s.activateAbilityKey('K');s.tickShieldThrow(.4);s.draw();s[reset](false);return !s.shieldFlight&&!s.heroAnimator.shieldAway&&!s.shieldThrow.image.visible&&!s.shieldThrow.ghosts.some(image=>image.visible)},reset),'scene transition clears the projectile and restores her held shield');
 assert(await page.evaluate(()=>{const s=window.elowen;s.begin();s.paused=true;s.shieldAbility='throw';s.upgrades=['throw'];s.stamina=24;s.activateAbilityKey('K');return s.stamina===24&&!s.shieldFlight}),'insufficient stamina cannot start a throw');
 assert.deepEqual(errors,[]);
 console.log('PASS: wind-up/release/catch, one spinning shield, shieldless movement/combat, damage/ranks/range, moving airborne catch, block/ice restrictions, no cooldown, pause and scene cleanup.');
} finally {await browser.close()}
