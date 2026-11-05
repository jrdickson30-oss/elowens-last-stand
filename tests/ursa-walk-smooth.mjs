import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const base=process.env.GAME_URL||'http://127.0.0.1:5188/';
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#begin').click({timeout:90000});
 const frames=await page.evaluate(()=>{
  const s=window.elowen;s.paused=true;const c=s.ursaMajor.meta.walk,im=s.add.image(0,0,'characters'),result=[];
  for(let i=0;i<c.frameCount;i++){
   s.ursaMajor.render(im,850,422,(i+.1)*c.durationsMs[i]/1000,1);const f=im.frame,ctx=document.createElement('canvas').getContext('2d');ctx.canvas.width=f.width;ctx.canvas.height=f.height;ctx.drawImage(f.source.image,f.cutX,f.cutY,f.width,f.height,0,0,f.width,f.height);const p=ctx.getImageData(0,0,f.width,f.height).data;let bottom=0,edge=0;
   for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){const a=p[(y*f.width+x)*4+3];if(a>100)bottom=Math.max(bottom,y+1);if(x===0||y===0||x===f.width-1||y===f.height-1)edge=Math.max(edge,a);}
   result.push({frame:Number(f.name),source:f.sourceIndex,image:f.source.image.tagName,src:f.source.image.src,ground:im.y+(bottom-im.displayOriginY)*im.scaleY,edge,angle:im.angle,uniformScale:im.scaleX===im.scaleY});
  }
  im.destroy();return {poses:result,method:c.method,hasRig:s.textures.exists('ursa-major-walk-rig')};
 });assert.equal(frames.poses.length,32);assert.equal(frames.method,'drawn-poses');assert.equal(frames.hasRig,false);
 for(const [i,f] of frames.poses.entries()){assert.equal(f.frame,i);assert.equal(f.source,i%2);assert.equal(f.image,'IMG','each pose comes from a complete drawn image');assert(f.src.length>0);assert(Math.abs(f.ground-422)<.01);assert(f.edge<100);assert.equal(f.angle,0);assert(f.uniformScale);}
 await page.evaluate(()=>{const s=window.elowen;s.enemies=[{x:1100,hp:145,max:145,next:999,speed:32,kind:2}];s.corpses=[];s.survivors=[];s.wall=null;s.x=650;s.hp=100;s.timer=999;s.paused=false;});await page.waitForTimeout(1800);await page.evaluate(()=>window.elowen.paused=true);await page.screenshot({path:'ursa-major-drawn-walk-game.png'});
 await page.goto(new URL('ursa-major/',base).href);await page.waitForFunction(()=>!!window.ursaPreview);
 for(let f=0;f<32;f++){await page.evaluate(f=>window.ursaPreview.seek(f),f);await page.waitForFunction(f=>document.querySelector('canvas').dataset.frame===String(f),f);}await page.locator('#step').click();await page.waitForFunction(()=>document.querySelector('canvas').dataset.frame==='0');await page.locator('#face').click();await page.waitForFunction(()=>document.querySelector('canvas').dataset.facing==='1');await page.screenshot({path:'ursa-major-drawn-walk-preview.png'});
 // A contact/passing pose board supports visual review; loading/grounding
 // assertions above are integration checks, not proof of anatomical quality.
 await page.evaluate(async()=>{const m=await(await fetch('./Ursa-major.json?v=drawn-walk3')).json(),img=new Image();img.src='./Ursa-major-walk-spritesheet-v3.png';await img.decode();const audit=document.createElement('canvas');audit.width=1500;audit.height=450;audit.style.maxWidth='1500px';audit.style.width='1500px';const ctx=audit.getContext('2d');ctx.fillStyle='#18251f';ctx.fillRect(0,0,1500,450);for(const [j,i] of [0,8,16,24].entries()){const c=m.walk,[x,y,w,h]=c.frameRects[i],scale=320/c.frameBodyHeights[i];ctx.save();ctx.translate(190+j*370,390);ctx.scale(scale,scale);ctx.drawImage(img,x,y,w,h,-c.frameAnchorX[i],-c.frameGroundY[i],w,h);ctx.restore();ctx.fillStyle='#ddd6c1';ctx.font='18px system-ui';ctx.fillText(['Contact A','Passing A','Contact B','Passing B'][j],120+j*370,430);}document.querySelector('main').style.visibility='hidden';audit.style.position='fixed';audit.style.top='320px';audit.style.left='0';document.body.append(audit);});await page.screenshot({path:'ursa-major-drawn-poses.png'});
 await page.goto(new URL('?renderer=canvas',base).href);await page.locator('#begin').click({timeout:90000});assert.deepEqual(await page.evaluate(()=>{const s=window.elowen;s.paused=true;s.enemies=[{x:850,hp:145,max:145,next:999,speed:32,kind:2,walkElapsed:.075}];s.draw();const im=s.spritePool.find(p=>p.visible&&p.getData('heroAction')==='enemy');return {texture:im.texture.key,source:im.frame.sourceIndex};}),{texture:'ursa-major-walk',source:1});
 assert.deepEqual(errors,[]);console.log('PASS: 32 complete drawn poses from both atlas pages, no cut-out rig, registered ground anchors, unmodified sprite geometry, full preview sequence and loop, mirrored view and Canvas fallback.');
}finally{await browser.close();}
