import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.GAME_URL||'http://127.0.0.1:5182/';
try{
 await page.goto(base);await page.locator('#begin').click({timeout:90000});
 await page.evaluate(()=>{const s=window.elowen;s.paused=true;s.timer=999;s.survivors=[];s.wall=null;s.corpses=[];s.x=650;s.y=422;s.vy=0;s.touch.clear();});
 for(const variant of ['claw','backhand']){
  const playback=await page.evaluate(async variant=>{
   const s=window.elowen,e={x:685,hp:200,max:200,next:0,speed:0,kind:1,nextClaw:variant};s.enemies=[e];s.hp=1000;s.inv=0;s.startZombieClaw(e,{kind:'hero'},s.x);s.paused=false;
   const frames=new Set(),start=s.clock;
   await new Promise((resolve,reject)=>{const check=()=>{s.draw();const im=s.spritePool.find(p=>p.visible&&p.getData('heroAction')==='enemy');if(im?.texture.key==='fast-zombie-'+variant)frames.add(Number(im.frame.name));if(!e.clawAttack){resolve();return;}if(s.clock-start>2){reject(Error('Attack did not recover'));return;}requestAnimationFrame(check);};requestAnimationFrame(check);});
   s.paused=true;return {frames:[...frames].sort((a,b)=>a-b),damage:1000-s.hp,duration:s.clock-start,expectedDamage:11-s.progression.armourBonus};
  },variant);
  assert.deepEqual(playback.frames,[0,1,2,3,4,5,6,7],variant+' must show the entire swing at normal playback speed');assert.equal(playback.damage,playback.expectedDamage);assert(playback.duration>=.95&&playback.duration<1.1);
 }
 const facing=await page.evaluate(()=>{
  const s=window.elowen,result=[];s.enemies=[];s.corpses=[];
  for(const face of [-1,1])for(const dir of [-1,1])for(const source of [undefined,'ember','volley','stone']){
   const e={x:1000,hp:1,max:1,next:0,speed:0,kind:1,clawAttack:{elapsed:0,face,landed:false,target:{kind:'hero'},duration:.96}};s.enemies=[e];s.draw();const live=s.spritePool.find(p=>p.visible&&p.getData('heroAction')==='enemy').flipX;
   s.hurt(e,10,dir,source);const c=s.corpses.at(-1);for(const time of [0,.12,.48,.84,.96,1.04,1.3,2.5,3.0,4.0]){c.elapsed=time;s.draw();const pair=s.corpsePool[s.corpses.length-1];if(pair.body.visible&&pair.body.flipX!==live)throw Error('Body changed facing');if(pair.next.visible&&pair.next.flipX!==live)throw Error('Decay changed facing');}
   result.push(c.facing===face);
  }
  return result;
 });assert.equal(facing.length,16);assert(facing.every(Boolean));
 const contact=await page.evaluate(()=>{
  const s=window.elowen,results=[];
  for(const [fall,decay] of [['fall','decompose'],['severed-fall','severed-decompose'],['burn-ignite','burn-out']]){
   const a=s.cache.json.get('fast-zombie-'+fall+'-meta'),b=s.cache.json.get('fast-zombie-'+decay+'-meta');
   const last=a.frameCount-1,from=(a.frameToeX[last]-a.frameAnchorX[last])*104/a.bodyHeight,to=(b.frameToeX[0]-b.frameAnchorX[0])*104/b.bodyHeight;
   results.push({fall,error:Math.abs(from-to)});
  }return results;
 });for(const c of contact)assert(c.error<.7,c.fall+' should preserve the grounded corpse into decay');
 await page.goto(new URL('fast-zombie-walk/',base).href);await page.waitForFunction(()=>!!window.fastZombiePreview);
 await page.evaluate(()=>window.fastZombiePreview.show('claw',0));await page.waitForFunction(()=>document.querySelector('canvas').dataset.frame==='0');
 for(let frame=1;frame<8;frame++){await page.locator('#step').click();await page.waitForFunction(frame=>document.querySelector('canvas').dataset.frame===String(frame),frame);}
 await page.locator('#slow').click();assert.equal(await page.locator('#slow').textContent(),'Normal speed');
 await page.evaluate(()=>window.fastZombiePreview.show('claw',480));await page.screenshot({path:'fast-zombie-slash-rework.png'});
 for(const action of ['fall','severed','burn','radiant','stone'])for(const face of [-1,1]){
  await page.evaluate(({action,face})=>{window.fastZombiePreview.setFacing(face);window.fastZombiePreview.show(action,0);},{action,face});
  for(const time of [0,360,840,1020,1500,2500]){await page.evaluate(({action,time})=>window.fastZombiePreview.show(action,time),{action,time});await page.waitForFunction(face=>document.querySelector('canvas').dataset.facing===String(face),face);assert(await page.locator('#face').isDisabled());}
 }
 await page.evaluate(()=>{window.fastZombiePreview.setFacing(-1);window.fastZombiePreview.show('fall',900);});await page.screenshot({path:'fast-zombie-collapse-rework.png'});
 assert.deepEqual(errors,[]);console.log('PASS: all eight frames play in both slashes at normal speed, one contact-timed hit, slower recovery, 16 front/back fatal-hit combinations preserve facing through every death, grounded decay joins, frame stepping and half-speed preview.');
}finally{await browser.close();}
