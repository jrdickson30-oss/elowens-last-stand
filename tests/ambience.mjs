import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');
 await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.enemies=[];s.survivors=[];s.scene.pause()});
 async function level(value,key) {
  assert(await page.evaluate(({value,key})=>{
   const s=window.elowen,previous=s.scenery;s.applyLevel(value);s.background();
   for(const child of s.children.list)child.setVisible(child===s.scenery);
   for(const child of s.scenery.list)if(child.type==='Text')child.setVisible(false);
   const ambient=s.scenery.getData('ambient'),shader=ambient.shader;
   const linked=shader.gl.getProgramParameter(shader.program.webGLProgram,shader.gl.LINK_STATUS);
   const upper=s.scenery.list.find(child=>child.type==='Image'&&child.frame.name==='upper');
   const lower=s.scenery.list.find(child=>child.type==='Image'&&child.frame.name==='lower');
   return !previous.scene&&s.scenery.getData('artKey')===key&&linked&&upper.y+upper.displayHeight===422&&lower.y===422;
  },{value,key}),'new artwork loaded, shader linked, previous scene destroyed, floor aligned');
 }
 async function snapshot(time,broken=false) {
  return page.evaluate(async ({time,broken})=>{
   const s=window.elowen,ambient=s.scenery.getData('ambient');ambient.time=time;ambient.update(0,broken);
   return new Promise(resolve=>s.game.renderer.snapshotArea(0,0,1280,720,im=>resolve(im.src),'image/png'));
  },{time,broken});
 }
 async function changed(a,b,rect) {
  return page.evaluate(async ({a,b,rect})=>{
   async function pixels(src){const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=1280;c.height=720;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return ctx.getImageData(...rect).data}
   const first=await pixels(a),second=await pixels(b);let count=0;
   for(let i=0;i<first.length;i+=4)if(Math.abs(first[i]-second[i])+Math.abs(first[i+1]-second[i+1])+Math.abs(first[i+2]-second[i+2])>8)count++;
   return count/(first.length/4);
  },{a,b,rect});
 }
 await level(1,'town-art');
 let a=await snapshot(0),b=await snapshot(3);
 assert(await changed(a,b,[1100,130,80,80])>.05,'rooftop fire flickers');
 assert(await changed(a,b,[1120,70,60,100])>.01,'smoke rises above burning roofs');
 assert.equal(await changed(a,b,[80,260,60,90]),0,'refuge gate remains rigid');
 await level(2,'burning-town-art');
 assert(await page.evaluate(()=>window.elowen.scenery.getData('ambient').config.fires.filter(f=>f.smoke).length>=8),'burning-town variant has additional smoke plumes');
 a=await snapshot(0);b=await snapshot(3);
 assert(await changed(a,b,[450,220,200,110])>.02,'additional town fires animate');
 await level(3,'grasslands-art');
 a=await snapshot(0);b=await snapshot(3);
 assert(await changed(a,b,[270,365,600,48])>.005,'grass moves in the wind');
 await level(6,'river-road-art');
 a=await snapshot(0);b=await snapshot(3);
 assert(await changed(a,b,[950,150,230,200])>.005,'tree foliage sways');
 const textureCount=await page.evaluate(()=>Object.keys(window.elowen.textures.list).length);
 await level(9,'bridge-art');
 a=await snapshot(0);b=await snapshot(3);
 assert(await changed(a,b,[120,570,1040,130])>.4,'foreground river flows and ripples');
 assert(await changed(a,b,[350,580,230,120])>.4,'sunlight reflection moves with the water');
 assert.equal(await changed(a,b,[705,402,80,15]),0,'bridge parapet remains rigid');
 assert.equal(await changed(a,b,[800,420,70,24]),0,'stone deck remains rigid');
 b=await snapshot(15);
 assert(await changed(a,b,[300,30,650,115])>.1,'clouds drift');
 const destroyed=await snapshot(3,true);
 assert(await changed(await snapshot(3),destroyed,[355,430,230,160])>.7,'destroyed bridge reveals animated river');
 // Rebuild repeatedly: temporary GPU textures must be released with their scenes.
 for(const value of [1,3,6,9])await level(value,value===1?'town-art':value===3?'grasslands-art':value===6?'river-road-art':'bridge-art');
 assert.equal(await page.evaluate(()=>Object.keys(window.elowen.textures.list).length),textureCount,'scene transitions do not leak textures');
 await page.evaluate(()=>{const s=window.elowen;for(const child of s.children.list)child.setVisible(true);s.scene.resume()});
 await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
 const paused=await page.evaluate(()=>window.elowen.scenery.getData('ambient').time);
 await page.waitForTimeout(350);
 assert.equal(await page.evaluate(()=>window.elowen.scenery.getData('ambient').time),paused,'pause freezes material motion and smoke');
 await page.locator('#resume').click();
 await page.waitForFunction(time=>window.elowen.scenery.getData('ambient').time>time,paused);
 assert.deepEqual(errors,[]);
 console.log('PASS: all five artworks, fixed ground and masonry, cloud/grass/tree motion, flowing river and reflections, fire/smoke, animated destruction, pause/resume, scene cleanup; no browser errors.');
} finally {await browser.close()}
