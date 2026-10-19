import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const fixture=()=>page.evaluate(()=>{
 const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.enemies=[];s.survivors=[];s.x=650;s.hp=40;
});
try {
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173/?renderer=canvas');await page.locator('#begin').click();
 await fixture();
 const probability=await page.evaluate(()=>{
  const drops=window.elowen.healingStims;
  const results=[0,.099999,.1,.99999].map(roll=>drops.tryDrop(900,roll));drops.reset();
  for(let i=0;i<1000;i++)drops.tryDrop(900,i/1000);
  return {results,count:drops.drops.length};
 });
 assert.deepEqual(probability,{results:[true,true,false,false],count:100},'10% threshold, without rounded-up boundary');
 // All kinds and attack sources share one lethal-damage hook, once per enemy.
 for(const kind of [0,1,2])for(const source of [null,'ember','ice','volley','stone']) {
  await fixture();
  const result=await page.evaluate(({kind,source})=>{
   const s=window.elowen,e={x:800,y:302,hp:10,max:10,next:999,speed:0,kind},random=Math.random;
   try {
    Math.random=()=>.099999;s.hurt(e,1,1,source??undefined);const nonlethal=s.healingStims.drops.length;
    s.hurt(e,10,1,source??undefined);s.hurt(e,999,1,source??undefined);
    return {nonlethal,drops:s.healingStims.drops.length,y:s.healingStims.drops[0].y,kills:s.kills};
   }finally{Math.random=random}
  },{kind,source});
  assert.deepEqual(result,{nonlethal:0,drops:1,y:422,kills:1});
 }
 await fixture();
 assert.equal(await page.evaluate(()=>{
  const s=window.elowen,random=Math.random;
  try{Math.random=()=>.1;s.hurt({x:800,hp:1,max:1,next:999,speed:0,kind:0},10);return s.healingStims.drops.length}finally{Math.random=random}
 }),0,'failed kill roll produces no stim');
 // Each drop has its own five-second gameplay lifetime, even at full SP.
 await fixture();
 const expiry=await page.evaluate(()=>{
  const s=window.elowen,d=s.healingStims;s.hp=s.maxHp;d.tryDrop(s.x,0);s.tickHealingStims(4);
  const atFour=d.drops.length;d.tryDrop(900,0);s.tickHealingStims(.5);
  const fading=d.drops[0].age;let bodyAlpha;
  const g=new Proxy({},{get:(_target,key)=>(...args)=>{if(key==='fillStyle'&&args[0]===0x172f2a&&bodyAlpha===undefined)bodyAlpha=args[1]}});
  d.render(g);s.tickHealingStims(.5);
  const remaining=d.drops.map(stim=>({x:stim.x,age:stim.age}));
  s.hp=40;s.x=650;s.tickHealingStims(.01);const noExpiredHeal=s.hp;
  s.x=900;s.tickHealingStims(.01);return {atFour,fading,bodyAlpha,remaining,noExpiredHeal,collected:s.hp,drops:d.drops.length};
 });
 assert.deepEqual(expiry,{atFour:1,fading:4.5,bodyAlpha:.5,remaining:[{x:900,age:1}],noExpiredHeal:40,collected:65,drops:0},'old stim fades and expires; newer drop stays independently collectable');
 // Pickup through the actual game tick: vertical range, clamping and no overheal.
 for(const level of [1,10])for(const face of [-1,1]) {
  await fixture();
  const result=await page.evaluate(({level,face})=>{
   const s=window.elowen;s.applyLevel(level);s.hp=40;s.face=face;s.healingStims.tryDrop(s.x,0);
   s.y=300;s.vy=0;s.tick(.01);const airborne={hp:s.hp,drops:s.healingStims.drops.length};
   s.y=422;s.vy=0;s.tick(.01);const picked={hp:s.hp,drops:s.healingStims.drops.length,message:s.message};s.tick(.01);const once=s.hp;
   s.hp=s.maxHp-5;s.healingStims.tryDrop(s.x,0);s.healingStims.tryDrop(s.x,0);s.tick(.01);
   const capped={hp:s.hp,max:s.maxHp,drops:s.healingStims.drops.length,message:s.message};s.tick(.01);
   return {airborne,picked,once,capped,retained:s.healingStims.drops.length};
  },{level,face});
  assert.deepEqual(result.airborne,{hp:40,drops:1});assert.equal(result.picked.hp,65);assert.equal(result.picked.drops,0);assert.match(result.picked.message,/\+25 SP/);assert.equal(result.once,65);
  assert.equal(result.capped.hp,result.capped.max);assert.equal(result.capped.drops,1);assert.match(result.capped.message,/\+5 SP/);assert.equal(result.retained,1,'full health leaves unused stims');
 }
 await fixture();
 assert.deepEqual(await page.evaluate(()=>{
  const s=window.elowen;s.healingStims.tryDrop(-100,0);s.healingStims.tryDrop(1260,0);return s.healingStims.drops.map(d=>d.x);
 }),[355,1000],'off-arena kills leave reachable stims');
 await fixture();
 assert(await page.evaluate(()=>{
  const s=window.elowen;s.healingStims.tryDrop(s.x,0);s.hp=0;s.tick(.01);return s.hp===0&&s.phase==='dead'&&s.healingStims.drops.length===0;
 }),'stim cannot revive a defeated Elowen');
 // Pausing freezes the visual and prevents collection.
 await fixture();await page.evaluate(()=>{const d=window.elowen.healingStims;d.tryDrop(650,0);d.drops[0].age=4.95});
 const before=await page.evaluate(()=>({hp:window.elowen.hp,age:window.elowen.healingStims.drops[0].age}));
 await page.waitForTimeout(160);
 assert.deepEqual(await page.evaluate(()=>({hp:window.elowen.hp,age:window.elowen.healingStims.drops[0].age})),before);
 // Same-level wave breaks retain supplies; level changes and restart clear them.
 assert(await page.evaluate(()=>{
  const s=window.elowen;s.wave++;s.startWave();s.paused=true;return s.healingStims.drops.length===1&&s.healingStims.drops[0].age===4.95;
 }));
 assert(await page.evaluate(()=>{
  const s=window.elowen;s.applyLevel(2);s.startWave();s.paused=true;return s.healingStims.drops.length===0;
 }));
 for(const action of ['begin','beginEnding']){
  await fixture();assert(await page.evaluate(action=>{const s=window.elowen;s.healingStims.tryDrop(800,0);s[action]();s.paused=true;return s.healingStims.drops.length===0},action));
 }
 // A leaking enemy is not a combat kill and cannot farm healing drops.
 await fixture();
 assert(await page.evaluate(()=>{
  const s=window.elowen,random=Math.random;s.enemies=[{x:299,hp:20,max:20,next:999,speed:0,kind:0}];
  try{Math.random=()=>0;s.tick(.01);return s.healingStims.drops.length===0&&s.kills===0}finally{Math.random=random}
 }));
 // Real keyboard movement collects a grounded stim without an extra button.
 await fixture();await page.evaluate(()=>{const s=window.elowen;s.x=540;s.healingStims.tryDrop(630,0);s.paused=false});
 await page.keyboard.down('D');await page.waitForFunction(()=>window.elowen.hp===65);await page.keyboard.up('D');
 assert.equal(await page.evaluate(()=>window.elowen.healingStims.drops.length),0);
 // Save an actual game-renderer preview of the medical canister.
 await fixture();await page.evaluate(()=>{const s=window.elowen;s.x=600;s.hp=70;s.healingStims.tryDrop(800,0);s.draw()});
 await mkdir('../downloads',{recursive:true});
 const png=await page.evaluate(()=>new Promise(resolve=>window.elowen.game.renderer.snapshotArea(520,280,420,200,img=>resolve(img.src))));
 await writeFile('../downloads/healing-stim-preview.png',Buffer.from(png.split(',')[1],'base64'));
 assert.deepEqual(errors,[]);
 console.log('PASS: five-second independent expiry with final-second fade, no expired healing, 10% chance, all combat sources, 25 SP pickup/cap, full-health retention until expiry, pause and lifecycle cleanup.');
}finally{await browser.close()}
