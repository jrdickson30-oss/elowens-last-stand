import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.GAME_URL);await page.locator('#begin').click();
 await page.evaluate(()=>{window.elowen.paused=true});
 for(const face of [1,-1])for(const extended of [false,true])for(const dt of [.01,.04]) {
  const result=await page.evaluate(({face,extended,dt})=>{
   const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.survivors=[];s.x=650;s.face=face;s.reachTime=extended?8:0;
   const targets=[[60,422],[-60,422],[0,260],[-65,260],[300,260],[0,800],[190,422],[-180,260]];
   const enemies=targets.map(([x,y])=>({x:s.x+face*x,y,hp:1000,max:1000,next:999,speed:0,kind:0}));s.enemies=enemies;
   s.touch.add('W');s.touch.add('J');s.tick(dt);s.heroAnimator.tick(dt,s.y,422,false,true);s.draw();
   const first=enemies.map(e=>e.hp),attack=s.risingAttack,range=attack.range;
   s.touch.clear();s.reachTime=0;const poses=[];
   for(let t=0;t<.7;t+=dt){
    s.draw();const im=s.spritePool.find(im=>im.visible&&im.getData('heroAction')===(extended?'risingReach':'rising'));
    if(im)poses.push({frame:im.getData('heroFrame'),flip:im.flipX,scale:im.scaleX,scaleY:im.scaleY,y:im.y,feet:s.y});
    s.tick(dt);s.heroAnimator.tick(dt,s.y,422,false,true);
   }
   return {first,hp:enemies.map(e=>e.hp),damage:s.damage,range,poses,ended:!s.risingAttack&&!s.heroAnimator.rising};
  },{face,extended,dt});
  assert.equal(result.first[0],1000-result.damage,'immediate melee hit');
  assert.deepEqual(result.hp.slice(0,4),Array(4).fill(1000-result.damage),'front, rear, above and upper rear take one hit');
  assert.deepEqual(result.hp.slice(4,6),[1000,1000],'far and below targets are excluded');
  assert.deepEqual(result.hp.slice(6),extended?Array(2).fill(1000-result.damage):[1000,1000],'Strike Through extends the full sweep');
  assert.equal(result.range,extended?230:115,'range remains fixed after buff expiry');
  assert.deepEqual([...new Set(result.poses.map(p=>p.frame))],[0,1,2,3,4,5,6,7,8]);
  assert(result.poses.every(p=>p.flip===(face<0)&&Math.abs(p.scale-96/(extended?285:360))<.001&&p.scale===p.scaleY&&p.y===p.feet));
  assert(result.ended);
 }
 for(const order of ['together','jumpFirst','attackFirst']) {
  const result=await page.evaluate(order=>{
   const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.survivors=[];s.spawned=0;s.x=650;s.face=1;
   const e={x:710,hp:1000,max:1000,next:999,speed:0,kind:0};s.enemies=[e];
   if(order!=='together'){s.touch.add(order==='jumpFirst'?'W':'J');s.tick(.02);s.heroAnimator.tick(.02,s.y,422,false,true)}
   s.touch.add('W');s.touch.add('J');s.tick(.02);s.heroAnimator.tick(.02,s.y,422,false,true);s.touch.clear();
   const started=!!s.risingAttack;
   for(let i=0;i<35;i++){s.tick(.02);s.heroAnimator.tick(.02,s.y,422,false,true)}
   return {started,hp:e.hp,damage:s.damage};
  },order);
  assert(result.started,order+' triggers the combo');assert.equal(result.hp,1000-result.damage,'buffered combo does not double-hit');
 }
 const effects=await page.evaluate(()=>{
  const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.survivors=[];s.enemies=[];s.x=650;s.face=1;s.reachTime=8;s.focusTime=8;s.crippleTime=8;s.abilityRanks.cripple=2;
  s.touch.add('W');s.touch.add('J');s.tick(.02);s.touch.clear();const attack=s.risingAttack;s.face=-1;s.focusTime=s.reachTime=0;
  const e={x:650,y:260,hp:1000,max:1000,next:999,speed:0,kind:0};s.enemies=[e];
  for(let i=0;i<23;i++)s.tick(.02);
  return {hp:e.hp,expected:1000-s.damage*1.75*1.75,rooted:e.rooted,face:attack.face,extended:attack.extended};
 });
 assert.equal(effects.hp,effects.expected);assert(effects.rooted>3);assert.equal(effects.face,1);assert(effects.extended);
 // Block, accepted Ember cast and lifecycle changes clear the shared combat/animation state.
 for(const cancel of ['block','ember','startWave','ending','death','restart']) {
  assert(await page.evaluate(cancel=>{
   const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.enemies=[];s.survivors=[];s.touch.add('W');s.touch.add('J');s.tick(.02);s.touch.clear();
   if(cancel==='block'){s.touch.add('L');s.tick(.02)}
   if(cancel==='ember')s.cast('ember');
   if(cancel==='startWave')s.startWave();
   if(cancel==='ending')s.beginEnding();
   if(cancel==='death')s.end(false);
   if(cancel==='restart')s.begin();
   s.paused=true;return !s.risingAttack&&!s.heroAnimator.rising;
  },cancel),cancel+' cancels both states');
 }
 // A late fresh attack uses the suspended aerial follow-up, not another launch.
 assert(await page.evaluate(()=>{
  const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.enemies=[];s.survivors=[];s.touch.add('W');s.tick(.02);s.touch.clear();for(let i=0;i<8;i++)s.tick(.02);s.touch.add('J');s.tick(.02);s.touch.clear();return !s.risingAttack&&s.aerialAttack?.kind==='spin';
 }));
 // Real keyboard input and pause, rather than exclusively simulated held keys.
 await page.evaluate(()=>{const s=window.elowen;s.begin();s.timer=999;s.spawned=0;s.enemies=[];s.survivors=[]});
 await page.keyboard.down('W');await page.keyboard.down('J');
 await page.waitForFunction(()=>!!window.elowen.risingAttack);await page.keyboard.up('W');await page.keyboard.up('J');
 await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
 const before=await page.evaluate(()=>window.elowen.risingAttack.elapsed);await page.waitForTimeout(160);
 assert.equal(await page.evaluate(()=>window.elowen.risingAttack.elapsed),before);
 await page.locator('#resume').click();await page.waitForFunction(()=>!window.elowen.risingAttack);
 const mobile=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const touchPage=await mobile.newPage();touchPage.on('pageerror',e=>errors.push(e.message));
 const mobileUrl=new URL(process.env.GAME_URL);mobileUrl.searchParams.set('renderer','canvas');
 await touchPage.goto(mobileUrl.href);await touchPage.locator('#begin').click();
 await touchPage.evaluate(()=>{const s=window.elowen;s.timer=999;s.spawned=0;s.enemies=[];s.survivors=[]});
 const points=[];
 for(const [id,key] of [[1,'W'],[2,'J']]){const b=await touchPage.locator(`[data-key=${key}]`).boundingBox();points.push({id,x:b.x+b.width/2,y:b.y+b.height/2})}
 const cdp=await mobile.newCDPSession(touchPage);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
 await touchPage.waitForFunction(()=>!!window.elowen.risingAttack);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert(await touchPage.evaluate(()=>window.elowen.touch.size===0));await mobile.close();
 assert.deepEqual(errors,[]);
 console.log('PASS: keyboard/mobile combo in either order, nine normal/blue spin poses, 25/100fps swept hits front/above/behind, one hit per enemy, full range, buff snapshots, fixed size, mirrored facing, pause, cancellation and restart.');
} finally {await browser.close()}
