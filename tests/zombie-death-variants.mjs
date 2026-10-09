import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.locator('#begin').click();
 await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
 const sequence=await page.evaluate(()=>{
  const s=window.elowen,enemy=(kind=0)=>({x:1000,y:422,hp:10,max:10,next:999,speed:0,kind});
  const first=enemy();s.hurt(first,1,1);const afterNonlethal=s.nextZombieDeath;
  s.hurt(first,20,1);const afterFirst=s.nextZombieDeath;s.hurt(first,20,1);const afterDuplicate=s.nextZombieDeath;
  s.hurt(enemy(1),20,1);s.hurt(enemy(2),20,1);const afterOtherKinds=s.nextZombieDeath;
  s.hurt(enemy(),20,-1);s.hurt(enemy(),20,1);s.hurt(enemy(),20,-1);
  s.draw();return {afterNonlethal,afterFirst,afterDuplicate,afterOtherKinds,
   variants:s.corpses.filter(c=>c.kind===0).map(c=>c.variant),kills:s.kills,
   textures:s.corpses.map((_,i)=>s.corpsePool[i].body.texture.key),blood:s.particles.filter(p=>p.color===0xb5151e||p.color===0x8e1018).length};
 });
 assert.equal(sequence.afterNonlethal,'fall');assert.equal(sequence.afterFirst,'severed');
 assert.equal(sequence.afterDuplicate,'severed');assert.equal(sequence.afterOtherKinds,'severed');
 assert.deepEqual(sequence.variants,['fall','severed','fall','severed']);assert.equal(sequence.kills,6);
 assert.deepEqual(sequence.textures,['zombie-fall','characters','characters','zombie-severed-fall','zombie-fall','zombie-severed-fall']);assert.equal(sequence.blood,60);
 const poses=await page.evaluate(()=>{
  const s=window.elowen,results=[];
  for(const dir of [-1,1]){
   const c={x:1000,y:302,dir,kind:0,variant:'severed',elapsed:0};s.corpses=[c];let time=0;
   for(let frame=0;frame<6;frame++){
    c.elapsed=(time+1)/1000;s.draw();const im=s.corpsePool[0].body,meta=s.deathAnimator.severedFall;
    const rect=meta.frameRects[frame];results.push({texture:im.texture.key,frame:im.frame.name,flip:im.flipX,dir,
     frameSize:[im.frame.width,im.frame.height],expectedSize:rect.slice(2),scale:im.scaleY,
     anchorError:Math.abs((im.y-im.originY*im.displayHeight)+meta.frameGroundY[frame]*im.scaleY-im.y)});
    time+=meta.durationsMs[frame];
   }
   for(const elapsed of [.72,1.4,2.3,3.9]){
    c.elapsed=elapsed;s.draw();const pair=s.corpsePool[0];results.push({stage:pair.body.getData('corpseStage'),texture:pair.body.texture.key,nextTexture:pair.next.visible?pair.next.texture.key:null,frame:pair.body.frame.name,alpha:pair.body.alpha,y:pair.body.y,flip:pair.body.flipX,dir});
   }
  }return results;
 });
 for(const p of poses){assert.equal(p.flip,p.dir>0);if(!p.stage){assert.equal(p.texture,'zombie-severed-fall');assert.deepEqual(p.frameSize,p.expectedSize);assert.ok(p.anchorError<.001)}
  else{assert.equal(p.y,422);if(p.stage==='settle'){assert.equal(p.texture,'zombie-severed-fall');assert.equal(p.nextTexture,'zombie-severed-decompose')}
   else assert.equal(p.texture,'zombie-severed-decompose');if(p.stage==='bones'){assert.equal(p.frame,5);assert.equal(p.alpha,1)}if(p.stage==='fade')assert.ok(p.alpha>0&&p.alpha<1);
  }
 }
 // Both variants remain independent when several enemies die together.
 await page.evaluate(()=>{const s=window.elowen;s.enemies=[];s.survivors=[];document.querySelector('#overlay').style.visibility='hidden';s.corpses=[
  {x:810,y:422,dir:1,kind:0,variant:'fall',elapsed:2.3},
  {x:970,y:422,dir:1,kind:0,variant:'severed',elapsed:.58},
  {x:1130,y:422,dir:1,kind:0,variant:'severed',elapsed:1.4},
  {x:1300,y:422,dir:-1,kind:0,variant:'severed',elapsed:2.3}];s.draw()});
 await page.screenshot({path:'zombie-severed-game.png'});
 assert.deepEqual(await page.evaluate(()=>window.elowen.corpsePool.slice(0,4).map(p=>p.body.texture.key)),['zombie-decompose','zombie-severed-fall','zombie-severed-decompose','zombie-severed-decompose']);
 const frozen=await page.evaluate(()=>window.elowen.corpses.map(c=>c.elapsed));await page.waitForTimeout(130);assert.deepEqual(await page.evaluate(()=>window.elowen.corpses.map(c=>c.elapsed)),frozen);
 const acrossWaves=await page.evaluate(()=>{const s=window.elowen;s.nextZombieDeath='severed';s.startWave();s.hurt({x:1000,hp:1,max:1,next:999,speed:0,kind:0},2,1);const result=s.corpses.at(-1).variant;s.begin();return {result,next:s.nextZombieDeath,count:s.corpses.length}});
 assert.deepEqual(acrossWaves,{result:'severed',next:'fall',count:0});
 await page.goto(new URL('zombie-walk/index.html',process.env.GAME_URL||'http://127.0.0.1:5173').href);
 await page.waitForFunction(()=>typeof document.querySelector('#kill')?.onclick==='function');
 await page.locator('#kill').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent.startsWith('Normal death'));
 await page.waitForFunction(()=>document.querySelector('#stage').textContent==='Walking');
 await page.locator('#kill').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent.startsWith('Severed death'));
 await page.waitForFunction(()=>document.querySelector('#stage').textContent==='Severed death · Bones');await page.locator('#pause').click();
 await page.screenshot({path:'zombie-severed-preview.png'});
 assert.deepEqual(errors,[]);console.log('PASS: alternating Zombie deaths, nonlethal/duplicate protection, other enemy isolation, blood splatter, every fall pose, both directions, ground anchors, matching decomposition, pause, wave/restart cycle and preview.');
}finally{await browser.close()}
