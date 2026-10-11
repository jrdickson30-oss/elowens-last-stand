import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173/');await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.x=650;s.face=1;s.timer=999;s.survivors=[];s.enemies=[{x:800,hp:40,max:40,next:999,speed:0,kind:0}];window.burnTarget=s.enemies[0]});
 await page.keyboard.press('E');await page.waitForFunction(()=>window.elowen.corpses[0]?.variant==='burn');
 await page.waitForFunction(()=>!window.elowen.enemies.length);
 await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
 const lethal=await page.evaluate(()=>{const s=window.elowen,p=s.corpsePool[0];return {kills:s.kills,waveKills:s.waveKills,variant:s.corpses[0].variant,next:s.nextZombieDeath,texture:p.body.texture.key}});
 assert.deepEqual(lethal,{kills:1,waveKills:1,variant:'burn',next:'fall',texture:'zombie-burn-ignite'});
 await page.evaluate(()=>window.elowen.hurt(window.burnTarget,100,1,'ember'));assert.equal(await page.evaluate(()=>window.elowen.corpses.length),1);
 const frozen=await page.evaluate(()=>window.elowen.corpses[0].elapsed);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.elowen.corpses[0].elapsed),frozen);
 const frames=await page.evaluate(()=>{
  const s=window.elowen,c=s.corpses[0],results=[];
  for(const dir of [-1,1])for(const action of ['ignite','out'])for(let frame=0;frame<6;frame++){
   c.dir=dir;c.y=422;c.elapsed=action==='ignite'?(frame*200+1)/1000:1.38+frame/5*1.42+.00001;s.draw();
   const im=s.corpsePool[0].body,clip=action==='ignite'?s.deathAnimator.burnIgnite:s.deathAnimator.burnOut;
   const canvas=document.createElement('canvas');canvas.width=im.frame.width;canvas.height=im.frame.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(im.texture.getSourceImage(),im.frame.cutX,im.frame.cutY,im.frame.width,im.frame.height,0,0,canvas.width,canvas.height);
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let left=canvas.width,right=0,top=canvas.height,bottom=0,orange=0;
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
    const i=(y*canvas.width+x)*4;if(pixels[i+3]<=90)continue;
    left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);
    if(pixels[i]>200&&pixels[i]>pixels[i+1]*1.35&&pixels[i+1]>60)orange++;
   }
   results.push({action,expected:frame,frame:im.frame.name,texture:im.texture.key,flip:im.flipX,dir,
    floor:im.y+(bottom-clip.frameGroundY[frame])*im.scaleY,clipped:left===0||right===canvas.width||top===0||bottom===canvas.height,
    width:right-left,height:bottom-top,orange});
  }return results;
 });
 for(const f of frames){assert.equal(f.frame,f.expected);assert.equal(f.texture,f.action==='ignite'?'zombie-burn-ignite':'zombie-burn-out');assert.equal(f.flip,f.dir>0);assert.ok(Math.abs(f.floor-422)<1);assert.equal(f.clipped,false);
  if(f.action==='out'&&f.frame===5){assert.ok(f.height<90&&f.width>f.height*3,'final pose is a low ash pile');assert.equal(f.orange,0,'final ash is extinguished')}
 }
 for(const [time,stage] of [[.1,'ignite'],[1.29,'burnout'],[2,'burnout'],[2.9,'ash'],[4.2,'ash'],[4.6,'fade']]){
  const pose=await page.evaluate(time=>{const s=window.elowen;s.corpses[0].elapsed=time;s.draw();const p=s.corpsePool[0];return {stage:p.body.getData('corpseStage'),texture:p.body.texture.key,frame:p.body.frame.name,alpha:p.body.alpha,next:p.next.visible?p.next.texture.key:null}},time);
  assert.equal(pose.stage,stage);if(stage==='ash'){assert.equal(pose.texture,'zombie-burn-out');assert.equal(pose.frame,5);assert.equal(pose.alpha,1)}
  if(stage==='fade')assert.ok(pose.alpha>0&&pose.alpha<1);
  if(time===1.29)assert.equal(pose.next,'zombie-burn-out');
 }
 const sources=await page.evaluate(()=>{
  const s=window.elowen,enemy=(kind=0)=>({x:1000,hp:10,max:10,next:999,speed:0,kind});s.corpses=[];
  const survived=enemy();s.hurt(survived,1,1,'ember');s.hurt(survived,20,1);
  s.hurt(enemy(),20,1,'ice');s.hurt(enemy(),20,1,'ember');s.hurt(enemy(2),20,1,'ember');s.hurt(enemy(),20,1);
  return {variants:s.corpses.map(c=>c.variant??null),next:s.nextZombieDeath};
 });
 assert.deepEqual(sources,{variants:['fall','severed','burn',null,'fall'],next:'severed'});
 const airborne=await page.evaluate(()=>{const s=window.elowen,c={x:1000,y:302,dir:-1,kind:0,variant:'burn',elapsed:.35};s.corpses=[c];s.draw();const halfway=s.corpsePool[0].body.y;c.elapsed=.7;s.draw();return {halfway,landed:s.corpsePool[0].body.y}});
 assert.deepEqual(airborne,{halfway:362,landed:422});
 await page.evaluate(()=>{const s=window.elowen;s.enemies=[];s.survivors=[];document.querySelector('#overlay').style.visibility='hidden';s.corpses=[
  {x:780,y:422,dir:1,kind:0,variant:'burn',elapsed:.05},
  {x:940,y:422,dir:1,kind:0,variant:'burn',elapsed:1.05},
  {x:1100,y:422,dir:1,kind:0,variant:'burn',elapsed:2.1},
  {x:1230,y:422,dir:1,kind:0,variant:'burn',elapsed:3.2}];s.draw()});
 await page.screenshot({path:'zombie-burn-game.png'});
 // Normal remains clean up first; the burn retains its opaque ash until 4.3s.
 const lifetime=await page.evaluate(()=>{const s=window.elowen;s.corpses=[{x:1000,y:422,dir:1,kind:0,variant:'fall',elapsed:4.2},{x:1100,y:422,dir:1,kind:0,variant:'burn',elapsed:4.2}];s.paused=false;s.update(0,0);s.paused=true;return s.corpses.map(c=>c.variant)});
 assert.deepEqual(lifetime,['burn']);
 await page.evaluate(()=>{const s=window.elowen;s.corpses=[{x:1000,y:422,dir:1,kind:0,variant:'burn',elapsed:2.1}];s.enemies=[];s.spawned=s.total;s.survivors=[];s.hp=100;document.querySelector('#overlay').style.visibility='visible'});
 await page.locator('#resume').click();await page.waitForFunction(()=>window.elowen.corpses[0]?.elapsed>2.3);
 assert.equal(await page.evaluate(()=>window.elowen.phase),'play');
 await page.waitForFunction(()=>window.elowen.phase==='wavebreak');assert.ok(await page.evaluate(()=>window.elowen.corpses[0].elapsed>=2.8));
 await page.waitForFunction(()=>!window.elowen.corpses.length);assert.ok(await page.evaluate(()=>window.elowen.corpsePool.every(p=>!p.body.visible&&!p.next.visible)));
 await page.evaluate(()=>{const s=window.elowen;s.hurt({x:1000,hp:1,max:1,next:999,speed:0,kind:0},2,1,'ember');s.begin()});
 assert.equal(await page.evaluate(()=>window.elowen.corpses.length),0);
 await page.goto(new URL('zombie-walk/index.html',process.env.GAME_URL||'http://127.0.0.1:5173/').href);
 await page.waitForFunction(()=>typeof document.querySelector('#burn')?.onclick==='function');await page.locator('#burn').click();
 await page.waitForFunction(()=>document.querySelector('#stage').textContent==='Ember death · Ash');await page.locator('#pause').click();
 await page.screenshot({path:'zombie-burn-preview.png'});
 await page.locator('#pause').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent==='Walking');
 await page.locator('#kill').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent.startsWith('Normal death'));
 assert.deepEqual(errors,[]);console.log('PASS: lethal Ember projectile, chest spread/collapse/extinguished ash, every sprite/crop/floor anchor, both directions, nonlethal/ice/sword selection, independent normal cycle, pause, airborne landing, wave timing, cleanup, restart and preview.');
}finally{await browser.close()}
