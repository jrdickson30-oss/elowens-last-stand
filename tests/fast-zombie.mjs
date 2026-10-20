import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.GAME_URL||'http://127.0.0.1:5181/';
try{
 await page.goto(base);await page.locator('#begin').click({timeout:90000});
 await page.evaluate(()=>{const s=window.elowen;s.paused=true;s.timer=999;s.survivors=[];s.wall=null;s.x=650;s.y=422;s.vy=0;});
 const movement=await page.evaluate(()=>{
  const s=window.elowen,e={x:1000,hp:200,max:200,next:999,speed:88,kind:1};s.enemies=[e];
  const texture=()=>{s.draw();return s.spritePool.find(p=>p.visible&&p.getData('heroAction')==='enemy').texture.key;};
  s.tick(.1);const run={x:e.x,texture:texture(),time:e.walkElapsed};e.rooted=2;s.tick(.1);const rooted={x:e.x,time:e.walkElapsed};
  e.rooted=0;e.x=680;s.tick(.01);const idle=texture();s.hurt(e,10,1);const hit=texture();e.hp=200;s.hurt(e,35,-1);const heavy=texture();
  s.tick(.01);for(let i=0;i<15;i++)s.tick(.02);const staggered=e.x;s.tick(.5);return {run,rooted,idle,hit,heavy,staggered,recovered:!e.hitReaction};
 });
 assert.equal(movement.run.texture,'fast-zombie-fast-walk');assert.equal(movement.run.x,991.2);assert.deepEqual(movement.rooted,{x:991.2,time:movement.run.time});
 assert.equal(movement.idle,'fast-zombie-idle');assert.equal(movement.hit,'fast-zombie-hit');assert.equal(movement.heavy,'fast-zombie-stagger');assert(movement.recovered);
 const combat=await page.evaluate(()=>{
  const s=window.elowen,e={x:685,hp:200,max:200,next:0,speed:0,kind:1};s.enemies=[e];s.touch.clear();s.x=650;s.hp=100;s.inv=0;
  const hits=[];
  for(let i=0;i<2;i++){e.x=685;e.next=0;s.inv=0;s.tick(.001);const variant=e.clawAttack.variant;s.tick(.47);const before=s.hp;s.tick(.011);s.draw();hits.push({variant,before,after:s.hp,texture:s.spritePool.find(p=>p.visible&&p.getData('heroAction')==='enemy').texture.key});s.tick(.49);}
  s.hp=s.stamina=100;s.face=1;s.inv=0;e.x=685;e.next=0;s.touch.add('L');s.tick(.001);s.tick(.481);s.draw();
  const block={hp:s.hp,stamina:s.stamina,attack:!!e.clawAttack,texture:s.spritePool.find(p=>p.visible&&p.getData('heroAction')==='enemy').texture.key};s.touch.clear();
  e.blockReaction=undefined;e.hitReaction=undefined;e.next=0;e.x=1000;s.wall={x:980,hp:110,max:110};s.tick(.001);const before=s.wall.hp;s.tick(.481);const wall={before,after:s.wall.hp};s.wall=null;
  return {hits,block,wall,damage:11-s.progression.armourBonus};
 });
 assert.deepEqual(combat.hits.map(h=>h.variant),['claw','backhand']);for(const h of combat.hits){assert.equal(h.before-h.after,combat.damage);assert.equal(h.texture,'fast-zombie-'+h.variant);}
 assert.deepEqual(combat.block,{hp:100,stamina:86,attack:false,texture:'fast-zombie-blocked'});assert.deepEqual(combat.wall,{before:110,after:98});
 const deaths=await page.evaluate(()=>{
  const s=window.elowen;s.enemies=[];s.corpses=[];s.nextZombieDeath=s.nextFastZombieDeath='fall';const out=[];
  for(const [kind,source] of [[1,undefined],[0,undefined],[1,undefined],[1,'ember'],[1,'volley'],[1,'stone']]){
   const e={x:1000,hp:1,max:1,next:0,speed:0,kind};s.hurt(e,10,1,source);const c=s.corpses.at(-1);s.draw();const pair=s.corpsePool[s.corpses.length-1];
   const record={kind,variant:c.variant,texture:pair.body.texture.key};c.elapsed=c.variant==='burn'?3:2.5;s.draw();record.remains=pair.body.texture.key;record.stage=pair.body.getData('corpseStage');out.push(record);
  }return out;
 });
 assert.deepEqual(deaths.map(d=>d.variant),['fall','fall','severed','burn','radiant','stone']);
 for(const d of deaths.filter(d=>d.kind===1)){assert(d.texture.startsWith('fast-zombie-'));assert(d.remains.startsWith('fast-zombie-'));assert.equal(d.stage,d.variant==='burn'?'ash':'bones');}
 const attachment=await page.evaluate(()=>{
  const s=window.elowen,a=s.fastZombieAnimator,im=s.add.image(0,0,'characters');let poses=0,stones=0;
  for(const action of ['walk','fast-walk','idle','claw','backhand','blocked','hit','stagger','fall','decompose','severed-fall','severed-decompose','radiant-fall','burn-ignite','burn-out'])for(const face of [-1,1]){
   const clip=s.cache.json.get('fast-zombie-'+action+'-meta');let ms=0;
   for(let frame=0;frame<clip.frameCount;frame++){
    const t=(ms+1)/1000;
    if(['walk','fast-walk','idle','claw','backhand','blocked','hit','stagger'].includes(action)){
     const hit=['hit','stagger'].includes(action)?{elapsed:t,dir:-face,...(action==='stagger'?{kind:'heavy'}:{})}:undefined;
     const attack=['claw','backhand'].includes(action)?{elapsed:t,face,variant:action,target:{kind:'hero'}}:undefined;
     a.render(im,800,422,t,face,hit,attack,{moving:action==='fast-walk',fast:true,idle:action==='idle',idleElapsed:t,blocked:action==='blocked'?{elapsed:t,face}:undefined});
    }else{
     // Exercise each source pose through the real frame registration and attachment renderer.
     im.setTexture('fast-zombie-'+action,frame).setOrigin(clip.frameAnchorX[frame]/im.frame.width,clip.frameGroundY[frame]/im.frame.height).setPosition(800,422).setScale(104/clip.bodyHeight).setFlipX(face<0).setAlpha(1).setVisible(true);
    }
    if(Number(im.frame.name)!==frame)throw Error(action+' pose '+frame+' did not play');
    s.zombieStones.reset();s.zombieStones.render(im,{elapsed:.4});const shards=s.zombieStones.pool.filter(p=>p.visible);
    if(shards.length!==6)throw Error('Missing shards on '+action+' '+frame);
    const ctx=document.createElement('canvas').getContext('2d');ctx.canvas.width=im.frame.width;ctx.canvas.height=im.frame.height;ctx.drawImage(im.texture.getSourceImage(),im.frame.cutX,im.frame.cutY,im.frame.width,im.frame.height,0,0,im.frame.width,im.frame.height);
    for(const p of shards){const x=im.displayOriginX+(im.flipX?-1:1)*(p.x-im.x)/im.scaleX,y=im.displayOriginY+(p.y-im.y)/im.scaleY;
     if(ctx.getImageData(Math.round(x),Math.round(y),1,1).data[3]<100)throw Error('Floating rock on '+action+' '+frame);stones++;}
    poses++;ms+=clip.durationsMs[frame];
   }
  }im.destroy();return {poses,stones};
 });assert.deepEqual(attachment,{poses:216,stones:1296});
 await page.evaluate(()=>{const s=window.elowen;s.corpses=[];s.enemies=[{x:800,hp:60,max:60,next:999,speed:88,kind:1,moving:true,walkElapsed:.2},{x:980,hp:60,max:60,next:999,speed:88,kind:1,hitReaction:{elapsed:.18,dir:1},stoneWounds:{elapsed:.4}}];s.draw();});
 await page.screenshot({path:'fast-zombie-game.png'});
 await page.goto(new URL('fast-zombie-walk/',base).href);await page.waitForFunction(()=>typeof document.querySelector('#hit')?.onclick==='function');
 await page.locator('[data-action=fast-walk]').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent==='Two-arm sprint');
 await page.screenshot({path:'fast-zombie-preview.png'});await page.locator('#claw').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent==='Claw slash');await page.waitForFunction(()=>document.querySelector('#stage').textContent==='Running');
 assert.deepEqual(errors,[]);console.log('PASS: fast zombie run, roots, idle, hit, heavy stagger, alternating timed slashes, shield rebound, wall damage, independent death alternation, all spell deaths, 216 mirrored poses and 1296 attached stones, preview playback.');
}finally{await browser.close();}
