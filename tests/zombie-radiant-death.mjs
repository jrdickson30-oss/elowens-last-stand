import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173/');await page.locator('#begin').click({timeout:60000});
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.survivors=[];s.upgrades.push('volley');s.enemies=[{x:800,hp:10,max:10,next:999,speed:0,kind:0}];window.radiantTarget=s.enemies[0]});
 await page.keyboard.press('3');await page.waitForFunction(()=>window.elowen.corpses[0]?.variant==='radiant');
 await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
 const cast=await page.evaluate(()=>{const s=window.elowen;return {kills:s.kills,waveKills:s.waveKills,next:s.nextZombieDeath,energy:s.energy,variant:s.corpses[0].variant}});
 assert.equal(cast.kills,1);assert.equal(cast.waveKills,1);assert.equal(cast.next,'fall');assert.equal(cast.variant,'radiant');assert.ok(cast.energy>=64&&cast.energy<75);
 await page.evaluate(()=>window.elowen.hurt(window.radiantTarget,99,1,'volley'));assert.equal(await page.evaluate(()=>window.elowen.corpses.length),1);
 const frozen=await page.evaluate(()=>window.elowen.corpses[0].elapsed);await page.waitForTimeout(140);assert.equal(await page.evaluate(()=>window.elowen.corpses[0].elapsed),frozen);
 const poses=await page.evaluate(()=>{
  const s=window.elowen,c=s.corpses[0],clip=s.deathAnimator.radiantFall,results=[];
  for(const dir of [-1,1]){let time=0;c.dir=dir;c.y=422;
   for(let frame=0;frame<6;frame++){
    c.elapsed=(time+1)/1000;s.draw();const im=s.corpsePool[0].body,canvas=document.createElement('canvas');canvas.width=im.frame.width;canvas.height=im.frame.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(im.texture.getSourceImage(),im.frame.cutX,im.frame.cutY,im.frame.width,im.frame.height,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let left=canvas.width,right=0,top=canvas.height,bottom=0;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>90){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1)}
    results.push({dir,frame:im.frame.name,expected:frame,texture:im.texture.key,flip:im.flipX,scale:im.scaleY,
     floor:im.y+(bottom-clip.frameGroundY[frame])*im.scaleY,clipped:left===0||right===canvas.width||top===0||bottom===canvas.height});time+=clip.durationsMs[frame];
   }
   c.elapsed=.35;s.draw();results.push({dir,stage:'reel',x:s.corpsePool[0].body.x,expectedX:c.x+dir*24});
   for(const elapsed of [.79,1.4,2.3,3.9]){
    c.elapsed=elapsed;s.draw();const p=s.corpsePool[0];results.push({dir,stage:p.body.getData('corpseStage'),texture:p.body.texture.key,next:p.next.visible?p.next.texture.key:null,
     scale:p.body.scaleY,nextScale:p.next.scaleY,y:p.body.y,alpha:p.body.alpha,frame:p.body.frame.name,x:p.body.x,expectedX:c.x+dir*32});
   }
  }return results;
 });
 for(const p of poses){if(!p.stage){assert.equal(p.frame,p.expected);assert.equal(p.texture,'zombie-radiant-fall');assert.equal(p.flip,p.dir>0);assert.ok(Math.abs(p.floor-422)<1);assert.equal(p.clipped,false)}
  else{assert.ok(Math.abs(p.x-p.expectedX)<.001);if(p.stage==='reel')continue;assert.equal(p.y,422);assert.equal(p.scale,104/444);
   if(p.stage==='settle'){assert.equal(p.texture,'zombie-radiant-fall');assert.equal(p.next,'zombie-decompose');assert.equal(p.nextScale,p.scale)}
   else assert.equal(p.texture,'zombie-decompose');if(p.stage==='bones'){assert.equal(p.frame,5);assert.equal(p.alpha,1)}if(p.stage==='fade')assert.ok(p.alpha>0&&p.alpha<1);
  }
 }
 const sources=await page.evaluate(()=>{
  const s=window.elowen,enemy=(kind=0)=>({x:800,hp:90,max:90,next:999,speed:0,kind});s.corpses=[];
  const survivor=enemy();s.enemies=[survivor];s.energy=100;s.spellCooldowns={};s.radiantVolley.reset();s.cast('volley');for(let i=0;i<70;i++)s.radiantVolley.tick(.02,(e,face)=>s.hurt(e,19,face,'volley'));const hp=survivor.hp,nonlethalCount=s.corpses.length;
  s.hurt(survivor,20,1);s.hurt(enemy(),100,-1,'volley');s.hurt(enemy(),100,1);s.hurt(enemy(),100,1,'ember');s.hurt(enemy(2),100,1,'volley');
  return {hp,nonlethalCount,variants:s.corpses.map(c=>c.variant??null),next:s.nextZombieDeath};
 });
 assert.deepEqual(sources,{hp:14,nonlethalCount:0,variants:['fall','radiant','severed','burn',null],next:'fall'});
 const airborne=await page.evaluate(()=>{const s=window.elowen;s.corpses=[{x:1000,y:302,dir:-1,kind:0,variant:'radiant',elapsed:.35}];s.draw();const halfway=s.corpsePool[0].body.y;s.corpses[0].elapsed=.7;s.draw();return {halfway,landed:s.corpsePool[0].body.y}});
 assert.deepEqual(airborne,{halfway:362,landed:422});
 await page.evaluate(()=>{const s=window.elowen;s.enemies=[];s.survivors=[];document.querySelector('#overlay').style.visibility='hidden';s.corpses=[
  {x:780,y:422,dir:1,kind:0,variant:'radiant',elapsed:.001},{x:940,y:422,dir:1,kind:0,variant:'radiant',elapsed:.19},
  {x:1090,y:422,dir:1,kind:0,variant:'radiant',elapsed:.48},{x:1210,y:422,dir:-1,kind:0,variant:'radiant',elapsed:2.3}];s.draw()});
 await page.screenshot({path:'zombie-radiant-game.png'});
 await page.evaluate(()=>{const s=window.elowen;s.corpses=[{x:1000,y:422,dir:1,kind:0,variant:'radiant',elapsed:1.7}];s.spawned=s.total;document.querySelector('#overlay').style.visibility='visible'});
 await page.locator('#resume').click();await page.waitForFunction(()=>window.elowen.corpses[0]?.elapsed>1.85);assert.equal(await page.evaluate(()=>window.elowen.phase),'play');
 await page.waitForFunction(()=>window.elowen.phase==='wavebreak');assert.ok(await page.evaluate(()=>window.elowen.corpses[0].elapsed>=2.08));
 await page.waitForFunction(()=>!window.elowen.corpses.length);assert.ok(await page.evaluate(()=>window.elowen.corpsePool.every(p=>!p.body.visible&&!p.next.visible)));
 await page.evaluate(()=>{const s=window.elowen;s.hurt({x:1000,hp:1,max:1,next:999,speed:0,kind:0},2,1,'volley');s.begin()});assert.equal(await page.evaluate(()=>window.elowen.corpses.length),0);
 await page.goto(new URL('zombie-walk/index.html',process.env.GAME_URL||'http://127.0.0.1:5173/').href);
 await page.waitForFunction(()=>typeof document.querySelector('#radiant')?.onclick==='function');await page.locator('#radiant').click();
 await page.waitForFunction(()=>document.querySelector('#stage').textContent.startsWith('Radiant death'));await page.locator('#pause').click();await page.screenshot({path:'zombie-radiant-preview.png'});
 await page.locator('#face').click();await page.locator('#pause').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent==='Walking');
 await page.locator('#kill').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent.startsWith('Normal death'));
 assert.deepEqual(errors,[]);console.log('PASS: Radiant volley finishing hit, star/recoil/fall poses, both directions, stronger backward motion, ground/scale continuity, nonlethal and other-source selection, independent normal cycle, airborne landing, pause, bones/wave timing, cleanup, restart and preview.');
}finally{await browser.close()}
