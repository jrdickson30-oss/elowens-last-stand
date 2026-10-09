import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');
 assert(!/chaosbound/i.test(await page.locator('body').innerText()),'site branding is independent');
 await page.locator('#begin').click();
 if(process.env.VILLAGER_SCREENSHOT){await page.waitForTimeout(250);await page.screenshot({path:process.env.VILLAGER_SCREENSHOT});}
 const groups=await page.evaluate(()=>{
  const s=window.elowen,random=Math.random;let seed=73;Math.random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
  const groups=[];try{for(let i=0;i<12;i++){s.startWave();groups.push(s.survivors.map(v=>v.villager))}}finally{Math.random=random}
  s.paused=true;return groups;
 });
 assert(groups.every(g=>g.length===5&&new Set(g).size===5),'five unique villagers per wave');
 assert(new Set(groups.flat()).size>20,'waves select varied appearances across the roster');
 const frames=await page.evaluate(()=>{
  const s=window.elowen;s.survivors=s.villagerAnimator.clips.map((c,i)=>({villager:c.id,x:150+i*25,t:.01}));s.enemies=[];
  const results=[];
  for(let frame=0;frame<6;frame++){
   for(const v of s.survivors)v.t=frame*.1+.01;s.draw();
   results.push(s.spritePool.filter(im=>im.visible&&im.getData('heroAction')==='villager').map(im=>({id:im.getData('villagerId'),key:im.texture.key,frame:im.frame.name,flip:im.flipX,originY:im.originY,scale:im.scaleY,angle:im.angle})));
  }
  return {results,clips:s.villagerAnimator.clips};
 });
 assert.equal(frames.clips.length,34);
 const mice=frames.clips.filter(c=>c.id.startsWith('rottan-mouse-'));assert.equal(mice.length,2);assert(mice.every(c=>c.displayHeight===34),'both Mouse Folk are half their previous 68px height');
 for(let frame=0;frame<6;frame++){
  assert.equal(frames.results[frame].length,34,'every villager renders');
  for(const im of frames.results[frame]){
   const c=frames.clips.find(c=>c.id===im.id);
   assert.equal(im.key,'villager-'+c.id);assert.equal(Number(im.frame),frame);
   assert.equal(im.flip,c.frameFlipX[frame]);assert.equal(im.angle,0);
   assert(Math.abs(im.originY-c.frameGroundY[frame]/c.frameHeight)<1e-6);
   assert(Math.abs(im.scale-c.displayHeight/c.bodyHeight)<1e-6);
  }
 }
 await page.evaluate(()=>{const s=window.elowen;s.startWave();s.timer=999;s.paused=false;});
 const before=await page.evaluate(()=>window.elowen.survivors[0].x);
 await page.waitForTimeout(250);
 assert(await page.evaluate(()=>window.elowen.survivors[0].x)<before,'villagers travel left');
 await page.evaluate(()=>{const s=window.elowen;s.survivors=[{...s.survivors[0],x:76}];});
 await page.waitForFunction(()=>window.elowen.survivors.length===0&&window.elowen.rescued===1);
 await page.evaluate(()=>window.elowen.upgrade());assert(!/chaosbound/i.test(await page.locator('body').innerText()),'upgrade menu has no affiliation branding');
 assert.deepEqual(errors,[]);
 console.log('PASS: randomized groups, all 34 six-frame animations, leftward facing/travel, Kin scales, ground anchors and rescue verified.');
}finally{await browser.close()}
