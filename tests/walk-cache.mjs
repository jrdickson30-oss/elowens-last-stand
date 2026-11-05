import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
try {
 const page=await browser.newPage(),errors=[],requested=[];
 page.on('pageerror',error=>errors.push(error.message));
 // Simulate an existing player's stale cached layout. Its unversioned sheet
 // is unavailable here, so a loader still using either old URL must fail.
 await page.route('**/elowen-walk/Elowen-walk*',async route=>{
  const url=new URL(route.request().url());requested.push(url);
  if(url.searchParams.has('v'))return route.continue();
  if(url.pathname.endsWith('.json'))return route.fulfill({json:{frameWidth:512,frameHeight:512,frameCount:6,columns:3,durationsMs:[120,120,120,120,120,120],anchor:{x:256,groundY:496},bodyHeight:454}});
  return route.abort();
 });
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173/?renderer=canvas');
 await page.locator('#begin').click({timeout:90000});
 const loaded=await page.evaluate(()=>{
  const s=window.elowen,clip=s.heroAnimator.clips.walk,image=s.textures.get('hero-walk').getSourceImage();
  s.paused=true;s.enemies=[];s.survivors=[];s.x=650;s.y=422;s.heroAnimator.reset();s.heroAnimator.moving=true;
  const rendered=[];
  for(let frame=0;frame<8;frame++) {
   s.heroAnimator.walkElapsed=(clip.meta.durationsMs.slice(0,frame).reduce((sum,ms)=>sum+ms,0)+1)/1000;s.draw();
   const sprite=s.spritePool.find(im=>im.visible&&im.getData('heroAction')==='walk');
   rendered.push(sprite?.getData('heroFrame'));
  }
  return {count:clip.meta.frameCount,width:image.width,height:image.height,rendered};
 });
 assert.equal(loaded.count,8,'stale six-pose metadata is bypassed');
 assert.deepEqual([loaded.width,loaded.height],[2048,1024],'replacement sprite sheet loads');
 assert.deepEqual(loaded.rendered,[0,1,2,3,4,5,6,7]);
 assert.equal(new Set(requested.map(url=>url.href)).size,2,'one sheet URL and its matching layout URL are requested');
 assert(requested.every(url=>url.searchParams.has('v')),'both resources bypass the old cache');
 assert.equal(new Set(requested.map(url=>url.searchParams.get('v'))).size,1,'the sheet and metadata use the same revision');
 assert.deepEqual(errors,[]);
 console.log('PASS in Edge: stale walk cache bypassed; matching eight-pose metadata and 2048x1024 sheet load and render every frame.');
} finally {await browser.close()}
