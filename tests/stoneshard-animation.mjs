import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL);await page.locator('#begin').click();
 for(const face of [-1,1])for(const crouch of [false,true])for(const dt of [.01,.04]){
  const result=await page.evaluate(({face,crouch,dt})=>{
   const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.enemies=[];s.survivors=[];s.x=650;s.face=face;s.crouching=crouch;s.upgrades=['stone'];
   const targets=[50,140,250,-60].map(dx=>({x:s.x+face*dx,y:422,hp:100,max:100,next:999,speed:0,kind:0}));s.enemies=targets;s.cast('stone');
   const initial=targets.map(e=>e.hp),cost=s.energy,cd=s.spellCooldowns.stone,origins=s.stoneshardBarrage.rocks.map(r=>({dx:(r.x-s.x)*face,floor:r.floor}));s.cast('stone');const count=s.stoneshardBarrage.rocks.length;
   const frames=[];for(const elapsed of [.001,.071,.161,.261,.401,.571,.761,.861]){
    s.heroAnimator.casting.elapsed=elapsed;s.draw();const im=s.spritePool.find(im=>im.visible&&im.getData('heroAction')==='stone');
    frames.push({frame:im.getData('heroFrame'),face:im.flipX,x:im.scaleX,y:im.scaleY,feet:im.y});
   }
   s.face=-face;const impacts=[],phases=new Set();let early;
   for(let time=0;time<2.4;time+=dt){
    s.stoneshardBarrage.tick(dt,(e,dir)=>{impacts.push({dir,time});s.hurt(e,38,dir,'stone')});s.draw();
    for(const im of s.stoneshardBarrage.pool.filter(im=>im.visible))phases.add(im.getData('stonePhase'));
    if(time<.28)early=targets.map(e=>e.hp);
   }
   return {initial,cost,cd,count,origins,frames,impacts,phases:[...phases],early,hp:targets.map(e=>e.hp),wounds:targets.slice(0,2).every(e=>!!e.stoneWounds),active:s.stoneshardBarrage.active,visible:s.stoneshardBarrage.pool.some(im=>im.visible)};
  },{face,crouch,dt});
  assert.deepEqual(result.initial,[100,100,100,100]);assert.deepEqual(result.early,result.initial,'no damage before rocks arrive');
  assert.equal(result.cost,70);assert.equal(result.cd,3);assert.equal(result.count,6,'cooldown blocks repeat cast');
  assert(result.origins.every(p=>p.dx>=24&&p.floor===422),'rock origins lie in the ground ahead');
  assert.deepEqual(result.frames.map(p=>p.frame),[0,1,2,3,4,5,6,7]);
  assert(result.frames.every(p=>p.face===(face<0)&&p.feet===422&&Math.abs(p.x-96/385)<.001&&Math.abs(p.y/p.x-(crouch?.65:1))<.001));
  assert.deepEqual(result.hp,[62,62,100,100]);assert.equal(result.impacts.length,2);assert(result.impacts.every(i=>i.dir===face&&i.time>.30));
  assert.deepEqual(result.phases,['lift','flight']);assert(result.wounds&&!result.active&&!result.visible);
 }
 // Eased movement retains a straight 30-degree path in either facing direction.
 for(const face of [-1,1])assert(await page.evaluate(face=>{
  const s=window.elowen;s.begin();s.paused=true;s.face=face;s.upgrades=['stone'];s.enemies=[];s.cast('stone');
  return s.stoneshardBarrage.rocks.every(rock=>{
   const origin=s.stoneshardBarrage.position(rock,0);
   return [.1,.25,.5,.75,1].every(progress=>{
    const p=s.stoneshardBarrage.position(rock,rock.duration*progress);
    return Math.abs(Math.atan2(origin.y-p.y,(p.x-origin.x)*face)-Math.PI/6)<1e-8;
   });
  });
 },face),'all six launches stay 30 degrees above horizontal');
 // Eased speed remains continuous throughout the launch.
 const flow=await page.evaluate(()=>{
  const s=window.elowen;s.begin();s.paused=true;s.face=1;s.upgrades=['stone'];s.enemies=[];s.cast('stone');
  const barrage=s.stoneshardBarrage,rock=barrage.rocks[0],points=[];
  for(let i=0;i<=100;i++)points.push(barrage.position(rock,rock.duration*i/100));
  const d=rock.duration/100,speeds=points.slice(1).map((p,i)=>({x:(p.x-points[i].x)/d,y:(p.y-points[i].y)/d}));
  const change=Math.max(...speeds.slice(1).map((v,i)=>Math.hypot(v.x-speeds[i].x,v.y-speeds[i].y)));
  const end=barrage.position(rock,rock.duration),nearEnd=barrage.position(rock,rock.duration-1e-5);
  return {forward:points.every((p,i)=>!i||p.x>=points[i-1].x),scale:points.every(p=>p.scale===1),angle:Math.max(...points.map(p=>Math.abs(p.angle))),change,
   rises:Math.min(...points.map(p=>p.y))<rock.floor-70,endSpeed:Math.hypot(end.x-nearEnd.x,end.y-nearEnd.y)/1e-5};
 });
 assert(flow.forward&&flow.scale&&flow.rises,JSON.stringify(flow));assert(flow.angle<=20&&flow.change<60&&flow.endSpeed<1,'gentle rotation and continuous velocities');
 // Killed targets cannot be hit a second time by pending projectiles.
 assert(await page.evaluate(()=>{
  const s=window.elowen;s.begin();s.paused=true;s.upgrades=['stone'];s.enemies=[{x:620,hp:1,max:1,next:999,speed:0,kind:0}];s.cast('stone');s.hurt(s.enemies[0],2);const kills=s.kills;
  s.stoneshardBarrage.tick(1,(e,f)=>s.hurt(e,38,f,'stone'));return s.kills===kills;
 }));
 for(const gate of ['locked','energy','block','focus'])assert(await page.evaluate(gate=>{
  const s=window.elowen;s.begin();s.paused=true;s.upgrades=gate==='locked'?[]:['stone'];s.energy=gate==='energy'?0:100;s.blocking=gate==='block';s.focusTime=gate==='focus'?1:0;
  const energy=s.energy;s.cast('stone');return !s.stoneshardBarrage.active&&s.energy===energy&&!s.spellCooldowns.stone;
 },gate),gate+' gate unchanged');
 // Pause freezes both the casting pose and the rocks; transitions clear pending hits.
 await page.evaluate(()=>{const s=window.elowen;s.begin();s.paused=true;s.upgrades=['stone'];s.cast('stone')});
 await page.evaluate(()=>{const s=window.elowen;s.stoneshardBarrage.tick(.65,(e,f)=>s.hurt(e,38,f,'stone'));s.draw()});
 const dust=await page.evaluate(()=>{const b=window.elowen.stoneshardBarrage;return {count:b.dust.length,grit:b.grit.length,visible:b.dustPool.filter(im=>im.visible).length,behind:b.dustPool.filter(im=>im.visible).every(im=>im.depth<1)}});
 assert(dust.count>10&&dust.grit>0&&dust.visible>10&&dust.behind,'billowing dust and grit fill the wake behind the character sprites');
 const contact=await page.evaluate(()=>{
  const s=window.elowen,b=s.stoneshardBarrage,check=()=>b.dustPool.filter(im=>im.visible).every(im=>im.y===im.getData('dustFloor')+1&&im.originY===.8&&im.angle===0&&im.getBounds().bottom>im.getData('dustFloor'));
  const first=check();b.tick(.3,(e,f)=>s.hurt(e,38,f,'stone'));s.draw();
  return {grounded:first&&check(),tall:b.dustPool.some(im=>im.visible&&im.getData('dustTop')<im.getData('dustFloor')-40),spread:new Set(b.dustPool.filter(im=>im.visible).map(im=>Math.round(im.x/10))).size};
 });
 assert(contact.grounded&&contact.tall&&contact.spread>=6,'the cloud fills from ground to flight height across the wake, without lifting its base');
 const frozen=await page.evaluate(()=>({pose:window.elowen.heroAnimator.casting.elapsed,rocks:window.elowen.stoneshardBarrage.rocks.map(r=>r.age),dust:window.elowen.stoneshardBarrage.dust.map(p=>p.age)}));await page.waitForTimeout(160);
 assert.deepEqual(await page.evaluate(()=>({pose:window.elowen.heroAnimator.casting.elapsed,rocks:window.elowen.stoneshardBarrage.rocks.map(r=>r.age),dust:window.elowen.stoneshardBarrage.dust.map(p=>p.age)})),frozen);
 for(const action of ['begin','startWave','beginEnding','end'])assert(await page.evaluate(action=>{
  const s=window.elowen;s.begin();s.paused=true;s.upgrades=['stone'];s.cast('stone');s[action](false);s.paused=true;return !s.stoneshardBarrage.active&&[...s.stoneshardBarrage.pool,...s.stoneshardBarrage.dustPool].every(im=>!im.visible);
 },action));
 assert.deepEqual(errors,[]);console.log('PASS: eight hand-sweep poses, ground lifting/flight in both directions, delayed one-hit 38 damage and existing cone/cost/cooldown, embedded shards, 25/100fps, pause/gates/dead-target/lifecycle cleanup.');
}finally{await browser.close()}
