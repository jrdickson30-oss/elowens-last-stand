import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5180/');await page.locator('#begin').click({timeout:60000});
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.survivors=[];s.upgrades.push('stone');s.enemies=[
  {x:620,hp:76,max:76,next:999,speed:0,kind:0},{x:660,hp:20,max:20,next:999,speed:0,kind:0},{x:950,hp:76,max:76,next:999,speed:0,kind:0}];window.stoneTarget=s.enemies[0]});
 await page.keyboard.press('4');await page.waitForFunction(()=>window.elowen.corpses[0]?.variant==='stone');
 await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
 const cast=await page.evaluate(()=>{const s=window.elowen;return {hp:window.stoneTarget.hp,kills:s.kills,waveKills:s.waveKills,next:s.nextZombieDeath,energy:s.energy,untouched:!!s.enemies[1].stoneWounds,wounded:!!window.stoneTarget.stoneWounds}});
 assert.equal(cast.hp,38);assert.equal(cast.kills,1);assert.equal(cast.waveKills,1);assert.equal(cast.next,'fall');assert.equal(cast.wounded,true);assert.equal(cast.untouched,false);assert.ok(cast.energy>=70&&cast.energy<73);
 const frozen=await page.evaluate(()=>[window.stoneTarget.stoneWounds.elapsed,window.elowen.corpses[0].elapsed]);await page.waitForTimeout(150);
 assert.deepEqual(await page.evaluate(()=>[window.stoneTarget.stoneWounds.elapsed,window.elowen.corpses[0].elapsed]),frozen);
 // Inspect opaque body pixels at every embedded base, through both facing directions.
 const anchors=await page.evaluate(()=>{
  const s=window.elowen,e=window.stoneTarget,c=s.corpses[0],results=[];s.enemies=[e];
  function check(phase){for(const im of s.zombieStones.pool.filter(im=>im.visible)){
   const body=im.getData('stoneOwner'),flip=body.flipX?-1:1,px=body.displayOriginX+flip*(im.x-body.x)/body.scaleX,py=body.displayOriginY+(im.y-body.y)/body.scaleY;
   const canvas=document.createElement('canvas');canvas.width=body.frame.width;canvas.height=body.frame.height;const ctx=canvas.getContext('2d');ctx.drawImage(body.texture.getSourceImage(),body.frame.cutX,body.frame.cutY,body.frame.width,body.frame.height,0,0,canvas.width,canvas.height);
   const sample=ctx.getImageData(Math.round(px)-2,Math.round(py)-2,5,5).data;let opaque=0;for(let p=3;p<sample.length;p+=4)if(sample[p]>90)opaque++;
   results.push({phase,texture:body.texture.key,frame:body.frame.name,index:im.getData('stoneIndex'),opaque,x:im.x,y:im.y,alpha:im.alpha,depth:im.depth>body.depth});
  }}
  for(const dir of [-1,1]){
   // Living render normally faces left; use sprite directly to inspect the reverse too.
   s.corpses=[];let time=0;
   for(let frame=0;frame<6;frame++){s.zombieStones.reset();s.spriteIndex=0;e.hitReaction=undefined;s.sprite(e.x,422,true,0,(time+1)/1000,dir,false,false,undefined,e.stoneWounds);check('walk');time+=s.zombieAnimator.clip.durationsMs[frame]}
   time=0;for(let frame=0;frame<6;frame++){s.zombieStones.reset();s.spriteIndex=0;const hit={dir,elapsed:(time+1)/1000};s.sprite(e.x,422,true,0,0,dir,false,false,hit,e.stoneWounds);check('hit');time+=s.zombieAnimator.hitClip.durationsMs[frame]}
   s.enemies=[];c.dir=dir;s.corpses=[c];time=0;
   for(let frame=0;frame<6;frame++){c.elapsed=(time+1)/1000;s.draw();check('fall');time+=s.deathAnimator.fall.durationsMs[frame]}
   for(const t of [.79,.89,1.12,1.38,1.62,1.86]){c.elapsed=t;s.draw();check('decay')}
   for(const variant of ['burn','radiant','severed']){c.variant=variant;for(const elapsed of variant==='burn'?[.001,.21,.41,.61,.81,1.01,1.21,1.4,1.7,2.1,2.5,2.7]:[.001,.11,.22,.36,.5,.64,.79,.89,1.1,1.4,1.8]){c.elapsed=elapsed;s.draw();check(variant)}}c.variant='stone';
   c.elapsed=2.08;s.draw();if(s.zombieStones.pool.some(im=>im.visible))throw Error('Shards survived completed decay');
  }return results;
 });
 assert.ok(anchors.length>150);assert.deepEqual(anchors.filter(a=>a.opaque===0),[],'Every shard base must touch opaque body artwork');for(const a of anchors){assert.ok(a.depth);assert.ok(a.alpha>0);assert.ok(a.y<425)}
 const lifecycle=await page.evaluate(()=>{
  const s=window.elowen,e=window.stoneTarget;s.corpses=[];s.enemies=[e];e.hitReaction=undefined;e.speed=50;e.stoneWounds.elapsed=4.7;const before=e.x;s.tick(.2);s.draw();
  const moved=e.x<before,following=s.zombieStones.pool.filter(im=>im.visible).every(im=>Math.abs(im.x-e.x)<60),alpha=s.zombieStones.pool.filter(im=>im.visible).map(im=>im.alpha);
  s.energy=100;s.spellCooldowns={};e.x=620;e.hp=100;s.cast('stone');const refreshed=e.stoneWounds.elapsed===0&&e.hp===62;
  e.stoneWounds.elapsed=6.5;s.draw();const remaining=s.zombieStones.pool.filter(im=>im.visible).length;
  s.hurt(e,100,1);s.draw();const retained=s.zombieStones.pool.filter(im=>im.visible).length,variant=s.corpses[0].variant,age=s.corpses[0].stoneWounds.elapsed;
  const enemy=(kind=0)=>({x:650,hp:100,max:100,next:999,speed:0,kind});
  const variants=[];for(const source of ['ember','volley',undefined]){const target=enemy();s.hurt(target,38,1,'stone');s.hurt(target,100,-1,source);const c=s.corpses.at(-1);variants.push(c.variant);c.elapsed=.2;s.draw();if(!s.zombieStones.pool.some(im=>im.visible&&im.getData('stoneOwner')===s.corpsePool.at(-1).body))throw Error('Lost rocks on '+source)}
  const normal=enemy();s.enemies=[normal];s.hurt(normal,38,1,'stone');normal.stoneWounds.elapsed=7.34;s.tick(.02);s.corpses=[];s.draw();const expired=!normal.stoneWounds&&s.zombieStones.pool.every(im=>!im.visible);
  const other=enemy(1);s.hurt(other,38,1,'stone');const otherWounded=!!other.stoneWounds;
  return {moved,following,alpha,refreshed,remaining,retained,variant,age,variants,expired,otherWounded};
 });
 assert.equal(lifecycle.moved,true);assert.equal(lifecycle.following,true);assert.ok(lifecycle.alpha.some(a=>a<1));assert.equal(lifecycle.refreshed,true);assert.equal(lifecycle.remaining,2);assert.equal(lifecycle.retained,2);assert.equal(lifecycle.variant,'fall');assert.equal(lifecycle.age,6.5);assert.deepEqual(lifecycle.variants,['burn','radiant','severed']);assert.equal(lifecycle.expired,true);assert.equal(lifecycle.otherWounded,false);
 await page.evaluate(()=>{const s=window.elowen;s.enemies=[{x:730,hp:38,max:76,next:999,speed:0,kind:0,stoneWounds:{elapsed:1,dir:1}}];s.survivors=[];document.querySelector('#overlay').style.visibility='hidden';s.corpses=[
  {x:880,y:422,dir:1,kind:0,variant:'stone',elapsed:.12,stoneWounds:{elapsed:0,dir:1}},
  {x:1040,y:422,dir:1,kind:0,variant:'stone',elapsed:.51,stoneWounds:{elapsed:0,dir:1}},
  {x:1190,y:422,dir:1,kind:0,variant:'stone',elapsed:1.4,stoneWounds:{elapsed:0,dir:1}}];s.draw()});
 await page.screenshot({path:'zombie-stones-game.png'});
 await page.evaluate(()=>{const s=window.elowen;s.corpses=[];s.begin();s.draw()});assert.ok(await page.evaluate(()=>window.elowen.zombieStones.pool.every(im=>!im.visible)));
 await page.goto(new URL('zombie-walk/index.html',process.env.GAME_URL||'http://127.0.0.1:5180/').href);
 await page.waitForFunction(()=>typeof document.querySelector('#stone-hit')?.onclick==='function');await page.locator('#stone-hit').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent.includes('Embedded shards'));
 await page.waitForTimeout(500);await page.locator('#pause').click();await page.screenshot({path:'zombie-stones-preview.png'});
 await page.locator('#face').click();await page.locator('#pause').click();await page.locator('#stone-death').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent.startsWith('Stoneshard death'));
 await page.waitForFunction(()=>document.querySelector('#stage').textContent==='Walking');await page.locator('#kill').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent.startsWith('Normal death'));
 assert.deepEqual(errors,[]);console.log('PASS: Actual Stoneshard cast, damage/range/energy, surviving wounds, per-pose body attachment in both directions, rock-covered fall and decay, movement, staggered fading, refreshed wounds, later killing attacks, no shard regrowth, pause, expiry, pool cleanup, restart and preview.');
}finally{await browser.close()}
