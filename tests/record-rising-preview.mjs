// Manual artifact exporter: capture the real game renderer on a plain stage.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try {
 const page=await browser.newPage();await page.goto(process.env.GAME_URL);await page.locator('#begin').click();
 for(const extended of [false,true]) {
  const folder=`../downloads/spiral-attack/game-${extended?'blue':'normal'}`;await mkdir(folder,{recursive:true});
  await page.evaluate(extended=>{
   const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.enemies=[];s.survivors=[];s.x=650;s.face=1;s.reachTime=extended?8:0;
   s.scenery.setVisible(false);s.hud.setVisible(false);s.labels.setVisible(false);s.cameras.main.setBackgroundColor('#101b20');
   for(const obj of s.children.list)if(obj.type==='Text')obj.setVisible(false);
   s.touch.add('W');s.touch.add('J');s.tick(.001);s.heroAnimator.tick(.001,s.y,422,false,true);s.touch.clear();
  },extended);
  for(let frame=0;frame<57;frame++) {
   const data=await page.evaluate(()=>new Promise(resolve=>{
    const s=window.elowen;s.draw();s.art.clear();s.drawRisingEnergy(s.art);s.art.lineStyle(1,0x47575b);s.art.lineBetween(370,422,930,422);
    s.game.renderer.snapshotArea(365,35,570,425,img=>resolve(img.src));
   }));
   await writeFile(`${folder}/${String(frame).padStart(2,'0')}.png`,Buffer.from(data.split(',')[1],'base64'));
   await page.evaluate(()=>{const s=window.elowen;s.tick(.02);s.heroAnimator.tick(.02,s.y,422,false,true)});
  }
 }
 console.log('Captured normal and Strike Through from the actual game renderer.');
}finally{await browser.close()}
