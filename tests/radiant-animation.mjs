import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5181/');await page.locator('#begin').click();
  await page.evaluate(()=>{const s=window.elowen;s.paused=true;s.timer=999;s.survivors=[];s.upgrades.push('volley');});
  for(const face of [1,-1])for(const crouch of [false,true]) {
    const result=await page.evaluate(({face,crouch})=>{
      const s=window.elowen,a=s.heroAnimator;s.x=face===1?450:1000;s.y=crouch?422:352;s.face=face;s.crouching=crouch;s.blocking=false;s.energy=100;s.spellCooldowns={};s.corpses=[];a.reset();s.radiantVolley.reset();
      const targets=[140,220,300,380].map(dx=>({x:s.x+face*dx,y:422,hp:100,max:100,next:999,speed:0,kind:0}));s.enemies=targets;s.cast('volley');
      const cost=s.energy,cd=s.spellCooldowns.volley,initial=targets.map(e=>e.hp),sky=s.radiantVolley.stars.map(p=>p.y);
      s.cast('volley');const count=s.radiantVolley.stars.length;
      const frames=[];for(const elapsed of [0,.081,.161,.261,.421,.521]){a.casting.elapsed=elapsed;s.draw();const im=s.spritePool.find(i=>i.visible&&i.getData('heroAction')==='radiant');frames.push({frame:im.getData('heroFrame'),flip:im.flipX,foot:im.y,scaleX:im.scaleX,scaleY:im.scaleY});}
      const hits=[];let before=[];
      for(let i=0;i<80;i++) {
        // Move each enemy sideways and vertically while stars pursue it.
        targets.forEach(e=>{e.x-=face*.8;e.y=422-Math.sin(i*.1)*12;});
        s.radiantVolley.tick(.02,(e,dir)=>{const p=s.radiantVolley.impacts.at(-1);hits.push({x:p.x,y:p.y,expectedX:e.x,expectedY:e.y-76,dir});s.hurt(e,19,dir,'volley');});
        if(i===19)before=targets.map(e=>e.hp);
      }
      return {cost,cd,initial,sky,count,frames,hits,before,hp:targets.map(e=>e.hp),remaining:s.radiantVolley.stars.length};
    },{face,crouch});
    assert.equal(result.cost,64);assert.equal(result.cd,4);assert.equal(result.count,4);assert.deepEqual(result.initial,[100,100,100,100]);assert.deepEqual(result.before,result.initial);
    assert(result.sky.every(y=>y<180));assert.deepEqual(result.hp,[81,81,81,81]);assert.equal(result.remaining,0);
    assert.deepEqual(result.frames.map(f=>f.frame),[0,1,2,3,4,5]);assert(result.frames.every(f=>f.flip===(face<0)&&f.foot===(crouch?422:352)&&Math.abs(f.scaleY/f.scaleX-(crouch?.65:1))<.001));
    assert.equal(result.hits.length,4);for(const h of result.hits){assert.equal(h.dir,face);assert(Math.abs(h.x-h.expectedX)<.001);assert(Math.abs(h.y-h.expectedY)<.001);}
  }
  const grouped=await page.evaluate(()=>{
    const s=window.elowen;s.x=500;s.y=422;s.face=1;s.crouching=false;s.energy=100;s.spellCooldowns={};s.corpses=[];s.radiantVolley.reset();s.enemies=[{x:850,hp:90,max:90,next:999,speed:0,kind:0}];s.cast('volley');
    for(let i=0;i<80;i++)s.radiantVolley.tick(.02,(e,f)=>s.hurt(e,19,f,'volley'));
    return {hp:s.enemies[0].hp,corpses:s.corpses.length};
  });assert.deepEqual(grouped,{hp:14,corpses:0});
  const gates=await page.evaluate(()=>{
    const s=window.elowen,results=[];
    for(const gate of ['empty','energy','block','focus','locked']) {
      s.energy=gate==='energy'?10:100;s.spellCooldowns={};s.blocking=gate==='block';s.focusTime=gate==='focus'?1:0;s.upgrades=gate==='locked'?[]:['volley'];s.enemies=gate==='empty'?[]:[{x:850,hp:100,max:100,next:999,speed:0,kind:0}];s.radiantVolley.reset();const before=s.energy;s.cast('volley');results.push({unchanged:s.energy===before,count:s.radiantVolley.stars.length,cd:s.spellCooldowns.volley??0});
    }s.blocking=false;s.focusTime=0;s.upgrades=['volley'];return results;
  });assert(gates.every(g=>g.unchanged&&g.count===0&&g.cd===0));
  // A target killed by another source cannot be killed a second time by its incoming stars.
  const dead=await page.evaluate(()=>{
    const s=window.elowen;s.energy=100;s.spellCooldowns={};s.corpses=[];s.enemies=[{x:850,hp:1,max:1,next:999,speed:0,kind:0}];s.cast('volley');s.hurt(s.enemies[0],2,1);const kills=s.kills;
    for(let i=0;i<80;i++)s.radiantVolley.tick(.02,(e,f)=>s.hurt(e,19,f,'volley'));
    return {kills:s.kills-kills,corpses:s.corpses.length};
  });assert.deepEqual(dead,{kills:0,corpses:1});
  await page.evaluate(()=>{const s=window.elowen;s.begin();s.timer=999;s.survivors=[];s.upgrades=['volley'];s.enemies=[{x:850,hp:10,max:10,next:999,speed:60,kind:0}];});
  await page.keyboard.press('3');await page.waitForFunction(()=>window.elowen.radiantVolley.active);
  await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
  const frozen=await page.evaluate(()=>({stars:window.elowen.radiantVolley.stars.map(s=>({age:s.age,x:s.x,y:s.y})),pose:window.elowen.heroAnimator.casting.elapsed}));await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>({stars:window.elowen.radiantVolley.stars.map(s=>({age:s.age,x:s.x,y:s.y})),pose:window.elowen.heroAnimator.casting.elapsed})),frozen);
  await page.locator('#resume').click();await page.waitForFunction(()=>window.elowen.corpses[0]?.variant==='radiant');assert.equal(await page.evaluate(()=>window.elowen.kills),1);
  await page.waitForFunction(()=>!window.elowen.radiantVolley.active);assert.equal(await page.evaluate(()=>window.elowen.kills),1);
  await page.evaluate(()=>{
    const s=window.elowen;s.paused=true;s.corpses=[];s.x=500;s.enemies=[760,890,1020,1150].map(x=>({x,hp:100,max:100,next:999,speed:0,kind:0}));s.energy=100;s.spellCooldowns={};s.radiantVolley.reset();s.cast('volley');
    for(let i=0;i<25;i++)s.radiantVolley.tick(.02,(e,f)=>s.hurt(e,19,f,'volley'));s.heroAnimator.casting.elapsed=.26;s.draw();
  });await page.screenshot({path:'radiant-spell-game.png'});
  for(const method of ['startWave','end','begin']) {
    const cleared=await page.evaluate(method=>{const s=window.elowen;s.phase='play';s.blocking=false;s.energy=100;s.spellCooldowns={};s.upgrades=['volley'];s.enemies=[{x:850,hp:90,max:90,next:999,speed:0,kind:0}];s.cast('volley');s[method](false);return !s.radiantVolley.active&&!s.radiantVolley.impacts.length&&!s.heroAnimator.casting;},method);assert(cleared,method);
  }
  assert.deepEqual(errors,[]);console.log('PASS: four sky-born stars, moving-target homing, delayed impacts, damage/cost/cooldown, six summoning poses, both directions, crouch/airborne, gates, repeated-target hits, no duplicate deaths, keyboard binding, pause and lifecycle cleanup.');
} finally {await browser.close();}
