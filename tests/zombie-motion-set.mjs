import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5181/');await page.locator('#begin').click({timeout:90000});
 await page.evaluate(()=>{const s=window.elowen;s.paused=true;s.timer=999;s.survivors=[];s.wall=null;});
 const gait=await page.evaluate(()=>{
  const s=window.elowen;s.x=650;s.y=422;s.vy=0;s.enemies=[{x:1000,hp:200,max:200,next:999,speed:50,kind:0}];const e=s.enemies[0];
  const texture=()=>{s.draw();return s.spritePool.find(p=>p.visible&&p.getData('heroAction')==='enemy').texture.key;};
  s.tick(.1);const slow={x:e.x,texture:texture()};e.speed=75;s.tick(.1);const fast={x:e.x,texture:texture()};e.speed=74;s.tick(.1);const back=texture();
  e.x=s.x+30;e.next=999;e.speed=50;e.walkElapsed=0;s.tick(.02);const idle={x:e.x,texture:texture(),time:e.idleElapsed};s.tick(.4);const later={x:e.x,time:e.idleElapsed};
  e.rooted=1;s.tick(.02);const rooted=texture();e.rooted=0;e.x=1000;s.tick(.1);return {slow,fast,back,idle,later,rooted,resumed:texture()};
 });
 assert.deepEqual(gait.slow,{x:995,texture:'zombie-walk'});assert.deepEqual(gait.fast,{x:987.5,texture:'zombie-fast-walk'});assert.equal(gait.back,'zombie-walk');assert.equal(gait.idle.texture,'zombie-idle');assert.equal(gait.later.x,gait.idle.x);assert(gait.later.time>gait.idle.time);assert.equal(gait.rooted,'zombie-walk');assert.equal(gait.resumed,'zombie-walk');
 const attacks=await page.evaluate(()=>{
  const s=window.elowen;s.enemies=[{x:685,hp:200,max:200,next:0,speed:0,kind:0}];const e=s.enemies[0],result=[];s.x=650;
  for(let i=0;i<4;i++){s.hp=100;s.inv=0;e.next=0;e.clawAttack=undefined;s.tick(.001);const variant=e.clawAttack.variant;s.tick(.21);const before=s.hp;s.tick(.011);s.draw();result.push({variant,before,hp:s.hp,texture:s.spritePool.find(p=>p.visible&&p.getData('heroAction')==='enemy').texture.key});s.tick(.43);}
  return {result,expected:100-(11-s.progression.armourBonus)};
 });
 assert.deepEqual(attacks.result.map(r=>r.variant),['claw','backhand','claw','backhand']);assert(attacks.result.every(r=>r.before===100&&r.hp===attacks.expected));assert.equal(attacks.result[1].texture,'zombie-backhand');
 const block=await page.evaluate(()=>{
  const s=window.elowen;s.hp=s.stamina=100;s.inv=0;s.face=1;s.touch.add('L');s.enemies=[{x:685,hp:200,max:200,next:0,speed:0,kind:0}];const e=s.enemies[0];s.tick(.001);s.tick(.221);s.draw();
  const result={hp:s.hp,stamina:s.stamina,reaction:!!e.blockReaction,attack:!!e.clawAttack,texture:s.spritePool.find(p=>p.visible&&p.getData('heroAction')==='enemy').texture.key};
  s.hurt(e,1);result.interrupted=!e.blockReaction&&!!e.hitReaction;s.touch.clear();return result;
 });assert.deepEqual(block,{hp:100,stamina:86,reaction:true,attack:false,texture:'zombie-blocked',interrupted:true});
 const heavy=await page.evaluate(()=>{
  const s=window.elowen;s.x=650;s.hp=100;s.inv=0;s.enemies=[{x:1000,hp:200,max:200,next:999,speed:50,kind:0}];const e=s.enemies[0];s.hurt(e,34);const ordinary=e.hitReaction.kind??'normal';e.x=1000;e.hp=200;s.hurt(e,35,1);s.tick(.001);for(let i=0;i<15;i++)s.tick(.02);s.draw();
  const result={ordinary,kind:e.hitReaction.kind,x:e.x,hp:e.hp,texture:s.spritePool.find(p=>p.visible&&p.getData('heroAction')==='enemy').texture.key};s.tick(.5);result.recovered=!e.hitReaction;result.moving=e.moving;return result;
 });assert.equal(heavy.ordinary,'normal');assert.equal(heavy.kind,'heavy');assert(Math.abs(heavy.x-1033)<.001);assert.equal(heavy.hp,165);assert.equal(heavy.texture,'zombie-stagger');assert(heavy.recovered&&heavy.moving);
 const pinned=await page.evaluate(()=>{const s=window.elowen;s.enemies=[{x:1000,hp:200,max:200,next:999,speed:50,kind:0,rooted:1}];const e=s.enemies[0];s.hurt(e,40,1);const x=e.x;s.tick(.01);s.tick(.3);return e.x===x&&e.hitReaction.kind==='heavy';});assert(pinned,'rooted enemies react without breaking immobilisation');
 const poses=await page.evaluate(()=>{
  const s=window.elowen,a=s.zombieAnimator,im=s.add.image(0,0,'characters'),result=[];
  for(const action of ['backhand','blocked','idle','stagger','fast-walk'])for(const face of [-1,1]){
   const clip=a.extra[action];let ms=0;
   for(let frame=0;frame<clip.frameCount;frame++){
    const elapsed=(ms+1)/1000,hit=action==='stagger'?{elapsed,dir:-face,kind:'heavy'}:undefined,attack=action==='backhand'?{elapsed,face,landed:false,variant:'backhand',target:{kind:'hero'}}:undefined;
    const motion={moving:action==='fast-walk',fast:true,idle:action==='idle',idleElapsed:elapsed,blocked:action==='blocked'?{elapsed,face}:undefined};
    s.zombieStones.reset();a.render(im,800,422,elapsed,face,hit,attack,motion);s.zombieStones.render(im,{elapsed:.4});
    const ctx=document.createElement('canvas').getContext('2d');ctx.canvas.width=im.frame.width;ctx.canvas.height=im.frame.height;ctx.drawImage(im.texture.getSourceImage(),im.frame.cutX,im.frame.cutY,im.frame.width,im.frame.height,0,0,im.frame.width,im.frame.height);
    const shards=s.zombieStones.pool.filter(p=>p.visible);let attached=true;
    for(const p of shards){const x=im.displayOriginX+(face<0?-1:1)*(p.x-im.x)/im.scaleX,y=im.displayOriginY+(p.y-im.y)/im.scaleY,pixels=ctx.getImageData(Math.round(x)-2,Math.round(y)-2,5,5).data;attached&&=Array.from(pixels).filter((v,i)=>i%4===3&&v>90).length>=15;}
    result.push({action,frame:im.frame.name,expected:frame,texture:im.texture.key,face,flip:im.flipX,feet:im.y,scale:im.scaleY,expectedScale:104/clip.bodyHeight,shards:shards.length,attached});ms+=clip.durationsMs[frame];
   }
  }im.destroy();return result;
 });
 assert.equal(poses.length,60);for(const p of poses){assert.equal(p.frame,p.expected);assert.equal(p.texture,'zombie-'+p.action);assert.equal(p.flip,p.face<0);assert.equal(p.feet,422);assert.equal(p.scale,p.expectedScale);assert.equal(p.shards,6);assert(p.attached,JSON.stringify(p));}
 await page.evaluate(()=>{const s=window.elowen;s.enemies=[{x:800,hp:100,max:100,next:999,speed:50,kind:0,idleElapsed:.4,moving:false}];s.draw();});
 const frozen=await page.evaluate(()=>window.elowen.enemies[0].idleElapsed);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.elowen.enemies[0].idleElapsed),frozen);
 await page.evaluate(()=>window.elowen.begin());assert.equal(await page.evaluate(()=>window.elowen.enemies.length),0);
 await page.goto(new URL('zombie-walk/?v=motions',process.env.GAME_URL||'http://127.0.0.1:5181/').href);await page.waitForFunction(()=>typeof document.querySelector('[data-action=idle]')?.onclick==='function');await page.locator('#pause').click();
 for(const [action,label] of [['fast-walk','Fast walk'],['idle','Idle twitch'],['backhand','Backhand slash'],['blocked','Blocked claw'],['stagger','Heavy stagger']]){await page.locator(`[data-action="${action}"]`).click();await page.waitForFunction(label=>document.querySelector('#stage').textContent===label,label);}
 await page.screenshot({path:'zombie-motions-preview.png'});await page.locator('#pause').click();await page.locator('[data-action=backhand]').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent==='Backhand slash');await page.waitForFunction(()=>document.querySelector('#stage').textContent==='Walking');assert.deepEqual(errors,[]);console.log('PASS: five new clips, alternating timed slashes, blocked claw recoil, heavy-hit threshold/step/recovery, speed-based gait without balance changes, stationary idle, 60 grounded mirrored poses and stone attachments, pause, restart and all preview controls.');
}finally{await browser.close();}
