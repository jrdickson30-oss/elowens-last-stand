import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');
 await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.enemies=[];s.survivors=[];s.spawned=0;});
 assert(await page.evaluate(()=>['slash','thrust','jump','reach'].every(id=>window.elowen.heroAnimator.clips[id]?.meta.frameCount===6)),'all supplied six-frame animations load');
 for(const expected of ['slash','thrust','slash']) {
  await page.keyboard.down('J');
  await page.waitForFunction(()=>!!window.elowen.heroAnimator.attack);
  await page.keyboard.up('J');
  const actual=await page.evaluate(()=>{const s=window.elowen,a=s.heroAnimator.attack,im=s.spritePool.find(im=>im.visible&&im.getData('heroAction')===a.kind);return {kind:a.kind,key:im?.texture.key,scale:im?.scaleY,interval:s.attackCd}});
  assert.equal(actual.kind,expected,'normal attacks alternate slash/thrust');
  assert.equal(actual.key,'hero-'+expected);
  assert(actual.scale>.45&&actual.scale<.6,'hero body retains the existing game scale');
  assert(actual.interval>0&&actual.interval<=.42,'existing sword cadence remains unchanged');
  await page.waitForFunction(()=>window.elowen.heroAnimator.attack===null);
 }
 await page.waitForFunction(()=>window.elowen.spritePool.some(im=>im.visible&&im.texture.key==='elowen-idle'&&im.displayHeight===96));

 // Watch an actual physics jump, including the landing, rather than looping
 // the preview's baked vertical motion on top of the game position.
 await page.evaluate(()=>{
  const s=window.elowen;s.data.set('jumpSamples',[]);
  const observe=()=>{const pose=s.heroAnimator.pose(s.vy);if(pose?.kind==='jump') {
   const im=s.spritePool.find(im=>im.visible&&im.texture.key==='hero-jump');
   if(im)s.data.get('jumpSamples').push({frame:pose.frame,y:s.y,origin:im.originY,scale:im.scaleY,renderY:im.y,height:im.frame.height});
  }};
  s.events.on('postupdate',observe);s.data.set('jumpObserver',observe);
 });
 await page.keyboard.down('Space');await page.waitForFunction(()=>window.elowen.y<400);await page.keyboard.up('Space');
 await page.waitForFunction(()=>window.elowen.y===422&&window.elowen.heroAnimator.landingTime===0);
 const samples=await page.evaluate(()=>{const s=window.elowen;s.events.off('postupdate',s.data.get('jumpObserver'));return s.data.get('jumpSamples')});
 assert.deepEqual([...new Set(samples.map(s=>s.frame))],[0,1,2,3,4,5],'jump follows crouch, launch, rise, apex, fall and landing');
 const suppliedBottoms=[272,268,217,180,253,272];
 for(const sample of samples) {
  assert.equal(sample.renderY,sample.y,'sprite follows the physics position');
  const renderedFoot=sample.renderY+(suppliedBottoms[sample.frame]-sample.origin*sample.height)*sample.scale;
  assert(Math.abs(renderedFoot-sample.y)<2,'baked sprite displacement is compensated at the feet');
 }

 // Exercise the real melee hit test in both directions and inspect the
 // visible energy bounds during each supplied effect frame.
 for(const face of [1,-1]) {
  await page.evaluate(face=>{const s=window.elowen;s.x=650;s.face=face;s.y=422;s.vy=0;s.attackCd=0;s.reachTime=8;s.heroAnimator.reset();s.enemies=[225,235].map(dx=>({x:s.x+face*dx,hp:160,max:160,next:999,speed:0,kind:0}));},face);
  await page.keyboard.down('J');await page.waitForFunction(()=>window.elowen.heroAnimator.attack?.kind==='reach');await page.keyboard.up('J');
  const hit=await page.evaluate(()=>{const s=window.elowen;return {hp:s.enemies.map(e=>e.hp),damage:s.damage}});
  assert.deepEqual(hit.hp,[160-hit.damage,160],'Strike Through hits within 230 pixels and excludes targets beyond it');
  await page.evaluate(()=>window.elowen.scene.pause());
  for(const frame of [3,4]) {
   const rendered=await page.evaluate(frame=>{
    const s=window.elowen,a=s.heroAnimator,clip=a.clips.reach,ds=clip.meta.durationsMs,total=ds.reduce((n,v)=>n+v,0);
    // Expiring the buff mid-swing must not shorten the already-started attack.
    s.reachTime=0;a.attack.elapsed=(ds.slice(0,frame).reduce((n,v)=>n+v,0)+1)/total*.42;s.draw();
    const im=s.spritePool.find(im=>im.visible&&im.getData('heroAction')==='reach'),rect=a.beam.getBounds();
    return {visible:a.beam.visible,face:a.attack.face,scale:im.scaleY,width:im.displayWidth,flip:im.flipX,near:rect.x,far:rect.right,x:s.x,frame:a.attackFrame()};
   },frame);
   assert(rendered.visible&&rendered.frame===frame,'provided energy appears on its effect frames');
   assert.equal(rendered.flip,face<0,'hero mirrors in the attack direction');
   assert(Math.abs((face>0?rendered.far:rendered.near)-(rendered.x+face*230))<.01,'visible energy reaches the full melee limit');
   assert(Math.abs(rendered.scale-96/191)<.001&&Math.abs(rendered.width-256*96/191)<.01,'extending energy does not stretch Elowen');
  }
  await page.screenshot({path:`/tmp/elowen-strike-through-${face>0?'right':'left'}.png`});
  await page.evaluate(()=>{const s=window.elowen;s.heroAnimator.attack.elapsed=.2;s.scene.resume()});
  await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
  const before=await page.evaluate(()=>window.elowen.heroAnimator.attack?.elapsed);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.elowen.heroAnimator.attack?.elapsed),before,'pause freezes attack animation');
  await page.locator('#resume').click();await page.waitForFunction(()=>window.elowen.heroAnimator.attack===null);
  assert(await page.evaluate(()=>!window.elowen.heroAnimator.beam.visible),'energy disappears after the attack');
 }
 await page.evaluate(()=>window.elowen.begin());
 assert(await page.evaluate(()=>{const a=window.elowen.heroAnimator;return a.attack===null&&a.nextAttack==='slash'&&!a.airborne&&a.landingTime===0&&!a.beam.visible}),'restart clears animations and resets the attack cycle');
 assert.deepEqual(errors,[]);
 console.log('PASS: supplied action sheets, game-sized bodies, alternating attacks, existing cadence, six physics-driven jump poses, foot alignment, full-range energy in both directions, unchanged reach damage, pause and restart; no browser errors.');
} finally {await browser.close()}
