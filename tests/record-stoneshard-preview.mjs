import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 const page=await browser.newPage();await page.goto(process.env.GAME_URL);await page.locator('#begin').click();
 const folder='../downloads/stoneshard-barrage-fast';await mkdir(folder+'/frames',{recursive:true});
 await page.evaluate(()=>{
  const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.survivors=[];s.x=500;s.face=1;s.upgrades=['stone'];s.enemies=[{x:660,hp:500,max:500,next:999,speed:0,kind:0}];
  s.hud.setVisible(false);s.labels.setVisible(false);for(const o of s.children.list)if(o.type==='Text')o.setVisible(false);
  s.cameras.main.setBackgroundColor('#101b20');
 });
 for(let frame=0;frame<120;frame++){
  await page.evaluate(frame=>{const s=window.elowen;if(frame===6)s.cast('stone');s.tick(.02);s.heroAnimator.tick(.02,s.y,422,false,true);s.draw()},frame);
  const png=await page.evaluate(()=>new Promise(resolve=>window.elowen.game.renderer.snapshotArea(390,245,440,225,img=>resolve(img.src))));
  await writeFile(`${folder}/frames/${String(frame).padStart(3,'0')}.png`,Buffer.from(png.split(',')[1],'base64'));
 }
 console.log('Captured the hand sweep, ground eruptions, flying rocks and enemy impacts from the actual game.');
}finally{await browser.close()}
