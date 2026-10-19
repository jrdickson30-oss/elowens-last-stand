import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5181/');await page.locator('#begin').click({timeout:90000});
 await page.evaluate(()=>{const s=window.elowen;s.paused=true;s.timer=999;s.survivors=[];});
 for(const face of [-1,1]){
  const attack=await page.evaluate(face=>{
   const s=window.elowen;s.x=650;s.y=422;s.vy=0;s.face=-face;s.hp=100;s.inv=0;s.wall=null;s.touch.clear();
   const e={x:s.x-face*35,hp:100,max:100,next:0,speed:50,kind:0};s.enemies=[e];s.tick(.01);
   const initial={hp:s.hp,elapsed:e.clawAttack.elapsed,face:e.clawAttack.face,x:e.x};
   s.tick(.21);const before=s.hp;s.tick(.011);const impact=s.hp;for(let i=0;i<22;i++)s.tick(.02);
   return {initial,before,impact,after:s.hp,expected:100-(11-s.progression.armourBonus),done:!e.clawAttack,x:e.x};
  },face);
  assert.equal(attack.initial.hp,100);assert.equal(attack.initial.elapsed,0);assert.equal(attack.initial.face,face);assert.equal(attack.before,100);assert.equal(attack.impact,attack.expected);assert.equal(attack.after,attack.impact);assert(attack.done);assert.equal(attack.x,attack.initial.x);
 }
 const responses=await page.evaluate(()=>{
  const s=window.elowen,result={};
  for(const mode of ['block','range','behind','air','hit','stun','death']){
   s.x=650;s.y=422;s.vy=0;s.face=1;s.hp=s.stamina=100;s.inv=0;s.touch.clear();s.wall=null;
   const e={x:685,hp:100,max:100,next:0,speed:0,kind:0};s.enemies=[e];s.tick(.01);
   if(mode==='block')s.touch.add('L');if(mode==='range')s.x=500;if(mode==='behind')s.x=720;if(mode==='air')s.y=200;
   if(mode==='hit')s.hurt(e,1);if(mode==='stun')e.stunned=1;if(mode==='death')s.hurt(e,200);
   s.tick(.23);result[mode]={hp:s.hp,stamina:s.stamina,x:e.x,attack:!!e.clawAttack};
  }s.touch.clear();return result;
 });
 assert(Object.values(responses).every(r=>r.hp===100));assert.equal(responses.block.stamina,86);assert.equal(responses.block.x,713);
 for(const mode of ['hit','stun','death'])assert.equal(responses[mode].attack,false);
 const wall=await page.evaluate(()=>{
  const s=window.elowen;s.x=500;s.y=422;s.vy=0;s.hp=100;s.face=1;s.touch.clear();s.upgrades=['vines'];s.energy=100;s.spellCooldowns={};s.cast('vines');
  const target=s.wall,e={x:target.x+25,hp:100,max:100,next:0,speed:50,kind:0};s.enemies=[e];s.tick(.01);s.tick(.21);const before=target.hp;s.tick(.011);const impact=target.hp;for(let i=0;i<20;i++)s.tick(.02);const after=target.hp;
  e.next=0;e.clawAttack=undefined;s.tick(.01);s.wall={...target,hp:110};s.tick(.23);return {before,impact,after,replacement:s.wall.hp};
 });assert.deepEqual(wall,{before:110,impact:98,after:98,replacement:110});
 const poses=await page.evaluate(()=>{
  const s=window.elowen,a=s.zombieAnimator,c=a.clawClip,im=s.add.image(0,0,'characters'),result=[];
  for(const face of [-1,1]){let ms=0;
   for(let frame=0;frame<c.frameCount;frame++){
    const attack={elapsed:(ms+1)/1000,face,landed:false,target:{kind:'hero'}};s.zombieStones.reset();a.render(im,800,422,0,face,undefined,attack);s.zombieStones.render(im,{elapsed:.4});
    const ctx=document.createElement('canvas').getContext('2d');ctx.canvas.width=im.frame.width;ctx.canvas.height=im.frame.height;ctx.drawImage(im.texture.getSourceImage(),im.frame.cutX,im.frame.cutY,im.frame.width,im.frame.height,0,0,im.frame.width,im.frame.height);
    let attached=true;const shards=s.zombieStones.pool.filter(p=>p.visible);
    for(const p of shards){const px=im.displayOriginX+(face<0?-1:1)*(p.x-im.x)/im.scaleX,py=im.displayOriginY+(p.y-im.y)/im.scaleY;const data=ctx.getImageData(Math.round(px)-2,Math.round(py)-2,5,5).data;attached&&=Array.from(data).filter((v,i)=>i%4===3&&v>90).length>=15;}
    result.push({frame:im.frame.name,expected:frame,texture:im.texture.key,flip:im.flipX,face,feet:im.y,scale:im.scaleY,shards:shards.length,attached});ms+=c.durationsMs[frame];
   }
  }im.destroy();return result;
 });
 assert.equal(poses.length,16);for(const p of poses){assert.equal(p.frame,p.expected);assert.equal(p.texture,'zombie-claw');assert.equal(p.flip,p.face<0);assert.equal(p.feet,422);assert.equal(p.scale,104/317);assert.equal(p.shards,6);assert(p.attached);}
 await page.evaluate(()=>{const s=window.elowen;s.begin();s.timer=999;s.survivors=[];s.enemies=[{x:s.x+35,hp:100,max:100,next:0,speed:0,kind:0}];});
 await page.waitForFunction(()=>window.elowen.enemies[0].clawAttack);await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
 const frozen=await page.evaluate(()=>({attack:window.elowen.enemies[0].clawAttack,hp:window.elowen.hp}));await page.waitForTimeout(160);assert.deepEqual(await page.evaluate(()=>({attack:window.elowen.enemies[0].clawAttack,hp:window.elowen.hp})),frozen);
 await page.locator('#resume').click();await page.waitForFunction(()=>window.elowen.hp<100);
 await page.evaluate(()=>{const s=window.elowen;s.paused=true;s.enemies[0].clawAttack={elapsed:.23,face:-1,landed:true,target:{kind:'hero'}};s.inv=0;s.draw();});await page.screenshot({path:'zombie-claw-game.png'});
 await page.evaluate(()=>window.elowen.begin());assert.equal(await page.evaluate(()=>window.elowen.enemies.length),0);
 await page.goto(new URL('zombie-walk/?v=claw',process.env.GAME_URL||'http://127.0.0.1:5181/').href);await page.waitForFunction(()=>typeof document.querySelector('#claw')?.onclick==='function');await page.locator('#claw').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent==='Claw slash');await page.locator('#pause').click();await page.screenshot({path:'zombie-claw-preview.png'});
 assert.deepEqual(errors,[]);console.log('PASS: claw anticipation, single timed hit, recovery/cooldown, both directions, block, miss, jump, hit/stun/death interrupts, wall damage/replacement, eight grounded poses, embedded stones, pause, restart and preview.');
}finally{await browser.close();}
