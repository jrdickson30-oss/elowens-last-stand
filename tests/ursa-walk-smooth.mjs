import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {sampleUrsaWalk,createUrsaWalkClip} from '../public/ursa-major/walk-rig.js';

const clip=createUrsaWalkClip(),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
assert.equal(clip.frameCount,120);assert.equal(clip.strideWorldPx,32*2);
for(let i=0;i<2400;i++){
 const p=i/2400,a=sampleUrsaWalk(p),b=sampleUrsaWalk(p+1/120);
 assert(a.near.stance||a.far.stance,'there is always a supporting paw');
 for(const side of ['near','far']){
  const l=a[side];assert(Math.abs(distance(l.hip,l.knee)-26)<1e-9,'thigh does not stretch');assert(Math.abs(distance(l.knee,l.ankle)-27)<1e-9,'shin does not stretch');
  assert(distance(l.ankle,b[side].ankle)<1.12,'no foot jumps between displayed poses');
  assert(distance(l.hip,b[side].hip)<.06,'no hip judder');
  if(l.stance){assert.equal(l.lift,0);assert.equal(l.footAngle,0);assert.equal(l.ankle.y,-10.35);}
 }
}
for(const side of ['near','far']){
 const offset=side==='near'?0:.5;
 for(let i=1;i<100;i++){
  const t=i/100,previous=sampleUrsaWalk(offset+(t-.01)*.5)[side],current=sampleUrsaWalk(offset+t*.5)[side];
  assert(Math.abs(current.ankle.x+32*t-(previous.ankle.x+32*(t-.01)))<1e-9,'support paw stays in the same world position');
 }
 for(const join of [0,.5,1]){
  const e=1e-5,a=sampleUrsaWalk(join-e)[side],b=sampleUrsaWalk(join)[side],c=sampleUrsaWalk(join+e)[side];
  for(const joint of ['hip','knee','ankle'])for(const axis of ['x','y'])assert(Math.abs((b[joint][axis]-a[joint][axis])/e-(c[joint][axis]-b[joint][axis])/e)<.08,'loop/contact joins preserve velocity');
 }
}

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const base=process.env.GAME_URL||'http://127.0.0.1:5187/';
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#begin').click({timeout:90000});
 const pixels=await page.evaluate(()=>{
  const s=window.elowen;s.paused=true;const c=s.ursaMajor.meta.walk,tex=s.textures.get('ursa-major-walk'),ctx=document.createElement('canvas').getContext('2d');ctx.canvas.width=c.frameWidth;ctx.canvas.height=c.frameHeight;
  const frames=[];let maxGroundError=0,edgeAlpha=0;
  for(let i=0;i<c.frameCount;i++){
   const [x,y,w,h]=c.frameRects[i];ctx.clearRect(0,0,w,h);ctx.drawImage(tex.getSourceImage(),x,y,w,h,0,0,w,h);const data=ctx.getImageData(0,0,w,h).data;let bottom=0;
   for(let py=0;py<h;py++)for(let px=0;px<w;px++){const alpha=data[(py*w+px)*4+3];if(alpha>100)bottom=Math.max(bottom,py+1);if(px===0||py===0||px===w-1||py===h-1)edgeAlpha=Math.max(edgeAlpha,alpha);}
   maxGroundError=Math.max(maxGroundError,Math.abs(bottom-c.frameGroundY[i])/2);frames.push(data);
  }
  const changes=frames.map((a,i)=>{const b=frames[(i+1)%frames.length];let total=0;for(let k=3;k<a.length;k+=4)total+=Math.abs(a[k]-b[k]);return total/(a.length/4*255);});
  return {count:frames.length,maxGroundError,edgeAlpha,maxChange:Math.max(...changes),seamChange:changes.at(-1),otherMaxChange:Math.max(...changes.slice(0,-1))};
 });assert.equal(pixels.count,120);assert.equal(pixels.edgeAlpha,0,'nothing clips the frame');assert(pixels.maxGroundError<1,'support paw meets the ground');assert(pixels.maxChange<.02,'no large silhouette jumps');assert(pixels.seamChange<pixels.otherMaxChange*1.3,'the loop seam is as smooth as other poses');
 await page.evaluate(()=>{const s=window.elowen;s.enemies=[{x:1100,hp:145,max:145,next:999,speed:32,kind:2}];s.corpses=[];s.survivors=[];s.wall=null;s.x=650;s.hp=100;s.timer=999;s.paused=false;});
 await page.waitForTimeout(2200);await page.evaluate(()=>window.elowen.paused=true);await page.screenshot({path:'ursa-major-smooth-walk-game.png'});
 await page.goto(new URL('ursa-major/',base).href);await page.waitForFunction(()=>!!window.ursaPreview);
 for(const f of [0,15,30,45,60,75,90,105,119]){await page.evaluate(f=>window.ursaPreview.seek(f),f);await page.waitForFunction(f=>document.querySelector('canvas').dataset.frame===String(f),f);}
 await page.locator('#step').click();await page.waitForFunction(()=>document.querySelector('canvas').dataset.frame==='0');await page.screenshot({path:'ursa-major-smooth-walk-preview.png'});
 // The same atlas must render on the game's basic-graphics path.
 await page.goto(new URL('?renderer=canvas',base).href);await page.locator('#begin').click({timeout:90000});assert.equal(await page.evaluate(()=>{const s=window.elowen;s.paused=true;s.enemies=[{x:850,hp:145,max:145,next:999,speed:32,kind:2,walkElapsed:1.25}];s.draw();return s.spritePool.find(p=>p.visible&&p.getData('heroAction')==='enemy').texture.key;}),'ursa-major-walk');
 assert.deepEqual(errors,[]);console.log('PASS: fixed-length limbs, continuous contact/loop velocities, ground-locked support paws, 120 unclipped poses, smooth silhouette and seam, full cycle controls and Canvas fallback.',JSON.stringify(pixels));
}finally{await browser.close();}
