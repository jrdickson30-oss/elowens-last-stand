import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try {
 const page=await browser.newPage();await page.goto(process.env.GAME_URL);await page.locator('#begin').click();
 const folder='../downloads/elowen-walk-v2/game-frames';await mkdir(folder,{recursive:true});
 await page.evaluate(()=>{
  const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.enemies=[];s.survivors=[];s.x=460;s.face=1;s.heroAnimator.reset();
  s.hud.setVisible(false);s.labels.setVisible(false);for(const o of s.children.list)if(o.type==='Text')o.setVisible(false);
 });
 for(let frame=0;frame<140;frame++) {
  await page.evaluate(frame=>{
   const s=window.elowen;
   s.touch.clear();if(frame<56)s.touch.add('D');else if(frame>=70&&frame<126)s.touch.add('A');
   s.tick(.02);s.heroAnimator.tick(.02,s.y,422,false,true,s.down('A')!==s.down('D'));
   s.draw();
  },frame);
  const png=await page.evaluate(()=>new Promise(resolve=>window.elowen.game.renderer.snapshotArea(365,300,650,150,img=>resolve(img.src))));
  await writeFile(`${folder}/${String(frame).padStart(3,'0')}.png`,Buffer.from(png.split(',')[1],'base64'));
 }
 console.log('Captured revised walk at actual movement speed in both directions, including stops.');
} finally {await browser.close()}
