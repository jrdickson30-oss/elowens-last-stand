import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.GAME_URL);await page.locator('#begin').click();
 for(const face of [1,-1])for(const extended of [false,true])for(const dt of [.01,.04]) {
  const result=await page.evaluate(({face,extended,dt})=>{
   const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.survivors=[];s.enemies=[];s.x=650;s.face=face;s.reachTime=extended?8:0;
   const step=()=>{s.tick(dt);s.heroAnimator.tick(dt,s.y,422,s.blocking,true,false,s.crouching);s.draw()};
   s.touch.add('W');s.touch.add('J');step();s.touch.clear();step();
   // Repress during the first rise: queue, then complete the first animation.
   s.touch.add('J');step();s.touch.clear();const queued=s.queuedAirAttack;
   while(s.risingAttack)step();
   const startY=s.y,originalFace=s.aerialAttack.face;
   const enemies=[60,-60,0,300,190].map((dx,i)=>({x:s.x+face*dx,y:s.y-(i===2?70:0),hp:1000,max:1000,next:999,speed:0,kind:0}));s.enemies=enemies;
   s.face=-face;s.reachTime=0;const ys=[],frames=[];
   while(s.aerialAttack){ys.push(s.y);frames.push(s.heroAnimator.pose(s.vy).frame);step()}
   const resumed={vy:s.vy,pose:s.heroAnimator.pose(s.vy),y:s.y};step();
   const fell=s.y>startY;
   return {queued,startY,originalFace,ys,frames,resumed,fell,hp:enemies.map(e=>e.hp),damage:s.damage};
  },{face,extended,dt});
  assert.equal(result.queued,'spin');assert.equal(result.originalFace,face);
  assert(result.ys.every(y=>Math.abs(y-result.startY)<.001),'vertical position freezes throughout the follow-up');
  assert.deepEqual([...new Set(result.frames)],[0,1,2,3,4,5,6,7,8]);
  assert.deepEqual(result.hp.slice(0,3),Array(3).fill(1000-result.damage),'follow-up hits front, rear and overhead once');
  assert.equal(result.hp[3],1000);assert.equal(result.hp[4],extended?1000-result.damage:1000,'captured reach survives expiry and turning');
  assert(result.resumed.vy>80&&result.resumed.pose.kind==='jump'&&result.resumed.pose.frame===4&&result.fell,'normal fall resumes');
 }
 for(const face of [1,-1])for(const extended of [false,true])for(const dt of [.01,.04]) {
  const result=await page.evaluate(({face,extended,dt})=>{
   const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.survivors=[];s.enemies=[];s.x=650;s.face=face;s.reachTime=extended?8:0;
   const step=()=>{s.tick(dt);s.heroAnimator.tick(dt,s.y,422,s.blocking,true,false,s.crouching);s.draw()};
   s.touch.add('W');s.touch.add('J');step();s.touch.clear();step();s.touch.add('J');step();s.touch.clear();while(s.risingAttack)step();
   // Queue the dive while the follow-up spin is still playing.
   const targets=[[-40,422],[35,422],[105,422],[-90,422],[260,422],[35,220],[190,422]];
   const enemies=targets.map(([dx,y])=>({x:s.x+face*dx,y,hp:1000,max:1000,next:999,speed:0,kind:0}));
   s.touch.add('S');s.touch.add('J');step();s.touch.delete('J');
   // Extra plain attacks must not overwrite the queued downward finish.
   step();s.touch.delete('S');s.touch.add('J');step();s.touch.delete('J');s.touch.add('S');
   while(s.aerialAttack?.kind==='spin')step();
   const started=s.aerialAttack.kind,dir=s.aerialAttack.face;s.face=-face;s.enemies=enemies;
   const before=enemies.map(e=>e.hp),poses=[],heights=[],scales=[];
   while(s.aerialAttack){
    const p=s.heroAnimator.pose(s.vy);poses.push(p.frame);heights.push(s.y);
    const im=s.spritePool.find(im=>im.visible&&im.getData('heroAction')===(extended?'diveReach':'dive'));
    if(im)scales.push(im.scaleX);step();
   }
   return {started,dir,before,hp:enemies.map(e=>e.hp),damage:s.damage,poses,heights,scales,y:s.y,recovered:s.heroAnimator.pose(s.vy)?.kind};
  },{face,extended,dt});
  assert.equal(result.started,'dive');assert.equal(result.dir,face);assert(result.before.every(hp=>hp===1000),'no remote ground damage at dive start');
  assert.deepEqual(result.hp.slice(0,3),Array(3).fill(1000-result.damage),'all adjacent/front ground enemies take one hit');
  assert.deepEqual(result.hp.slice(3,6),[1000,1000,1000],'rear distant, forward distant and high targets excluded');
  assert.equal(result.hp[6],extended?1000-result.damage:1000);
  assert.deepEqual([...new Set(result.poses)],[0,1,2,3,4,5]);
  assert(result.scales.every(scale=>Math.abs(scale-96/450)<.001),'landing crouch does not shrink the sword or body');
  assert.equal(result.y,422);assert.equal(result.recovered,'crouch');
 }
 // Holding attack never queues the follow-up automatically.
 assert(await page.evaluate(()=>{
  const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.enemies=[];s.survivors=[];s.touch.add('W');s.touch.add('J');s.tick(.02);s.touch.delete('W');let chained=false;
  for(let i=0;i<45;i++){s.tick(.02);chained||=!!s.aerialAttack}
  return !chained;
 }));
 // Repeated fresh presses cannot indefinitely extend the airborne suspension.
 for(const face of [1,-1])for(const extended of [false,true])for(const dt of [.01,.04]) {
  const result=await page.evaluate(({face,extended,dt})=>{
   const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.enemies=[];s.survivors=[];s.face=face;s.reachTime=extended?8:0;
   const step=()=>s.tick(dt);
   s.touch.add('W');s.touch.add('J');step();s.touch.clear();step();s.touch.add('J');step();s.touch.clear();
   let spins=0,previous=null,landed=false;
   for(let i=0;i<Math.ceil(2/dt);i++){
    if(i%2===0)s.touch.add('J');else s.touch.delete('J');step();
    if(s.aerialAttack?.kind==='spin'&&s.aerialAttack!==previous){spins++;previous=s.aerialAttack}
    if(s.y===422&&!s.risingAttack&&!s.aerialAttack){landed=true;break}
   }
   s.touch.clear();step();const rearmed=!s.airSpinUsed;
   // A new jump permits its own suspended spin.
   s.touch.add('W');step();s.touch.clear();for(let i=0;i<Math.ceil(.16/dt);i++)step();s.touch.add('J');step();s.touch.clear();
   return {spins,landed,rearmed,next:s.aerialAttack?.kind};
  },{face,extended,dt});
  assert.deepEqual(result,{spins:1,landed:true,rearmed:true,next:'spin'},'one spin per jump despite repeated tapping, rearmed on landing');
 }
 // Cancelling a spin must not grant another suspension before landing.
 for(const cancel of ['block','ember'])assert(await page.evaluate(cancel=>{
  const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.enemies=[];s.survivors=[];s.y=330;s.vy=120;s.jumpFacing=1;s.startAerialAttack('spin');
  if(cancel==='block'){s.touch.add('L');s.tick(.02);s.touch.clear()}else s.cast('ember');
  s.heroAnimator.casting=null;s.tick(.02);s.touch.add('J');s.tick(.02);s.touch.clear();
  return s.airSpinUsed&&!s.aerialAttack&&s.vy>0;
 },cancel),cancel+' does not reset the once-per-jump limit');
 // Cancellation releases suspension; lifecycle resets clear queued attacks.
 for(const action of ['block','ember','wave','restart','death','ending']) {
  assert(await page.evaluate(action=>{
   const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.enemies=[];s.survivors=[];s.touch.add('W');s.tick(.02);s.touch.clear();for(let i=0;i<8;i++)s.tick(.02);s.touch.add('J');s.tick(.02);s.touch.clear();s.queuedAirAttack='dive';
   if(action==='block'){s.touch.add('L');s.tick(.02)}
   if(action==='ember')s.cast('ember');
   if(action==='wave')s.startWave();
   if(action==='restart')s.begin();
   if(action==='death')s.end(false);
   if(action==='ending')s.beginEnding();
   return !s.aerialAttack&&!s.heroAnimator.aerial&&!s.queuedAirAttack;
  },action),action+' clears the aerial state');
 }
 // Pause freezes both the attack and its suspended position.
 await page.evaluate(()=>{const s=window.elowen;s.begin();s.timer=999;s.spawned=0;s.enemies=[];s.survivors=[];s.jumpFacing=1;s.y=330;s.vy=140;s.startAerialAttack('spin');s.paused=true});
 const frozen=await page.evaluate(()=>({y:window.elowen.y,elapsed:window.elowen.aerialAttack.elapsed}));await page.waitForTimeout(160);
 assert.deepEqual(await page.evaluate(()=>({y:window.elowen.y,elapsed:window.elowen.aerialAttack.elapsed})),frozen);
 assert.deepEqual(errors,[]);
 console.log('PASS: one suspended spin per jump despite repeated presses, landing rearms it, cancellation cannot bypass the cap, buffered dive survives extra taps, normal/blue poses, facing/damage/range, 25/100fps, pause and resets.');
}finally{await browser.close()}
