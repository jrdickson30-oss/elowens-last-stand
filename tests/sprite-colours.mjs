import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.locator('#begin').click();
 const result=await page.evaluate(()=>{
  const s=window.elowen;s.paused=true;s.timer=999;s.enemies=[];s.survivors=[];
  const audit=[];
  for(const key of s.textures.getTextureKeys().filter(k=>k==='elowen'||k==='elowen-idle'||k.startsWith('hero-'))){
   const source=s.textures.get(key).getSourceImage(),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);const data=ctx.getImageData(0,0,source.width,source.height).data;let magenta=0;
   for(let i=0;i<data.length;i+=4){const [r,g,b,a]=data.slice(i,i+4);if(a>32&&r>150&&b>120&&r>g*1.4&&b>g*1.4&&Math.abs(r-b)<100)magenta++}
   audit.push({key,magenta});
  }
  const poses=[];for(let i=0;i<6;i++){s.idleFrame=i;s.draw();const im=s.spritePool.find(im=>im.visible&&im.texture.key==='elowen-idle');poses.push({height:im.displayHeight,y:im.y,frame:im.frame.name,cutY:im.frame.cutY,cutHeight:im.frame.height})}
  return {audit,poses};
 });
 assert(result.audit.length>=10);assert(result.audit.every(a=>a.magenta===0),'all loaded Elowen textures are free of magenta');
 assert.equal(result.poses.length,6);assert(result.poses.every(p=>p.height===96&&p.y===422));
 assert.deepEqual(result.poses.map(p=>p.frame),['idle0','idle1','idle2','idle3','idle4','idle5']);
 await page.screenshot({path:'.playwright/clean-idle.png'});
 assert.deepEqual(errors,[]);console.log('PASS: all loaded Elowen sprites free of magenta; six idle frames at consistent size and ground position.');
}finally{await browser.close()}
