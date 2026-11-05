import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1200}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.GAME_URL||'http://127.0.0.1:5185/';
try{
 await page.goto(base);await page.locator('#begin').click({timeout:90000});await page.evaluate(()=>{const s=window.elowen;s.paused=true;s.timer=999;s.survivors=[];s.corpses=[];s.wall=null;s.x=650;s.y=422;s.vy=0;s.touch.clear();});
 const sequence=await page.evaluate(()=>{
  const s=window.elowen,e={x:685,hp:500,max:500,next:0,speed:32,kind:2};s.enemies=[e];const hits=[];
  for(let i=0;i<4;i++){s.x=650;s.hp=100;s.inv=0;e.x=685;e.next=0;s.tick(.001);const a=e.clawAttack,action=a.ursaAttack,cooldown=e.next;s.tick(.599);const before=s.hp;s.tick(.002);s.draw();const texture=s.spritePool.find(p=>p.visible&&p.getData('heroAction')==='enemy').texture.key,x=e.x;s.tick(.3);const after=s.hp;s.tick(.31);hits.push({action,cooldown,before,after,texture,stationary:e.x===x,recovered:!e.clawAttack});}
  return {hits,damage:20-s.progression.armourBonus};
 });assert.deepEqual(sequence.hits.map(x=>x.action),['sword','claw','sword','claw']);for(const h of sequence.hits){assert.equal(h.before,100);assert.equal(h.after,100-sequence.damage);assert.equal(h.texture,'ursa-major-'+h.action+'-attack');assert(h.stationary&&h.recovered);assert.equal(h.cooldown,1.35);}
 const mechanics=await page.evaluate(()=>{
  const s=window.elowen,result={};
  const fresh=()=>{s.healingStims.reset();s.x=650;s.y=422;s.hp=s.stamina=100;s.inv=0;s.touch.clear();s.wall=null;const e={x:685,hp:145,max:145,next:0,speed:0,kind:2};s.enemies=[e];s.tick(.001);return e;};
  for(const reason of ['outOfRange','behind','jump']){const e=fresh();if(reason==='outOfRange')s.x=500;else if(reason==='behind')s.x=710;else{s.y=200;s.vy=-450;}s.tick(.601);result[reason]=s.hp===100&&e.clawAttack.face===-1;}
  let e=fresh();s.face=1;s.touch.add('L');s.tick(.601);result.block={hp:s.hp,stamina:s.stamina,landed:e.clawAttack.landed};s.touch.clear();
  e=fresh();s.hurt(e,1,1);s.tick(.7);result.hitInterrupted=!e.clawAttack&&s.hp===100;
  e=fresh();e.stunned=.8;s.tick(.01);s.tick(.65);result.stunInterrupted=!e.clawAttack&&s.hp===100;
  e=fresh();s.hurt(e,999,1);result.deathInterrupted=!e.clawAttack;
  e=fresh();s.wall={x:980,hp:110,max:110};e.x=1000;e.next=0;e.clawAttack=undefined;s.tick(.001);s.tick(.599);const before=s.wall.hp;s.tick(.002);result.wall={before,after:s.wall.hp};
  e=fresh();const old={x:980,hp:110,max:110};s.wall=old;e.x=1000;e.next=0;e.clawAttack=undefined;s.tick(.001);s.wall={x:980,hp:110,max:110};s.tick(.601);result.replacedWall=old.hp===110&&s.wall.hp===110;
  return result;
 });for(const k of ['outOfRange','behind','jump','hitInterrupted','stunInterrupted','deathInterrupted','replacedWall'])assert(mechanics[k],k);assert.deepEqual(mechanics.block,{hp:100,stamina:86,landed:true});assert.deepEqual(mechanics.wall,{before:110,after:86});
 const registration=await page.evaluate(()=>{
  const s=window.elowen,c=s.ursaMajor.meta.walk,im=s.add.image(0,0,'characters'),result=[];
  for(let i=0;i<c.frameCount;i++){s.ursaMajor.render(im,800,422,(i+.1)*c.durationsMs[i]/1000,1);const ctx=document.createElement('canvas').getContext('2d');ctx.canvas.width=im.frame.width;ctx.canvas.height=im.frame.height;ctx.drawImage(im.frame.source.image,im.frame.cutX,im.frame.cutY,im.frame.width,im.frame.height,0,0,im.frame.width,im.frame.height);const p=ctx.getImageData(0,0,im.frame.width,im.frame.height).data;let top=im.frame.height,bottom=0;for(let y=0;y<im.frame.height;y++)for(let x=0;x<im.frame.width;x++)if(p[(y*im.frame.width+x)*4+3]>100){top=Math.min(top,y);bottom=Math.max(bottom,y);}result.push({height:(bottom+1-top)*im.scaleY,ground:im.y+(bottom+1-im.displayOriginY)*im.scaleY});}
  im.destroy();return {poses:result,method:c.method};
 });assert.equal(registration.poses.length,32);for(const p of registration.poses){assert(Math.abs(p.height-124)<2);assert(Math.abs(p.ground-422)<1);}assert.equal(registration.method,'drawn-poses');
 for(const action of ['sword','claw']){
  const frames=await page.evaluate(async action=>{const s=window.elowen,e={x:685,hp:500,max:500,next:0,speed:0,kind:2,nextUrsaAttack:action};s.enemies=[e];s.corpses=[];s.wall=null;s.x=650;s.y=422;s.vy=0;s.hp=1000;s.inv=0;s.touch.clear();s.startZombieClaw(e,{kind:'hero'},s.x);s.paused=false;const found=new Set();await new Promise(resolve=>{function sample(){const im=s.spritePool.find(p=>p.visible&&p.getData('heroAction')==='enemy');if(im?.texture.key==='ursa-major-'+action+'-attack')found.add(Number(im.frame.name));if(!e.clawAttack){resolve();return;}requestAnimationFrame(sample);}requestAnimationFrame(sample);});s.paused=true;return [...found].sort((a,b)=>a-b);},action);assert.deepEqual(frames,[0,1,2,3,4,5,6,7]);
 }
 await page.goto(new URL('ursa-major/',base).href);await page.waitForFunction(()=>!!window.ursaPreview);
 for(const action of ['sword','claw']){await page.evaluate(action=>window.ursaPreview.seek(0,action),action);await page.waitForFunction(action=>document.querySelector('canvas').dataset.action===action&&document.querySelector('canvas').dataset.frame==='0',action);for(let f=1;f<8;f++){await page.locator('#step').click();await page.waitForFunction(f=>document.querySelector('canvas').dataset.frame===String(f),f);}await page.evaluate(action=>window.ursaPreview.seek(action==='sword'?3:4,action),action);await page.waitForFunction(action=>document.querySelector('canvas').dataset.frame===String(action==='sword'?3:4),action);await page.screenshot({path:'ursa-major-'+action+'-attack-preview.png'});}
 await page.locator('#alternate').click();await page.waitForFunction(()=>document.querySelector('canvas').dataset.action==='sword');await page.waitForFunction(()=>document.querySelector('canvas').dataset.action==='claw');await page.waitForFunction(()=>document.querySelector('canvas').dataset.action==='sword');
 assert.deepEqual(errors,[]);console.log('PASS: sword/claw/sword/claw alternation, contact-only single damage, stationary swings and recovery, misses/jumps/shields/hit-stun/death interruption, timed wall strikes, 32 grounded full-body drawn walk poses, full real-time attack playback and preview alternation.');
}finally{await browser.close();}
