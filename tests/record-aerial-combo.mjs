import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 const page=await browser.newPage();await page.goto(process.env.GAME_URL);await page.locator('#begin').click();
 for(const scenario of ['spin-fall','spin-dive','blue-spin-dive']){
  const folder=`../downloads/aerial-combo/${scenario}`;await mkdir(folder,{recursive:true});
  await page.evaluate(scenario=>{
   const s=window.elowen;s.begin();s.paused=true;s.timer=999;s.spawned=0;s.enemies=[];s.survivors=[];s.x=650;s.face=1;s.reachTime=scenario.startsWith('blue')?8:0;
   s.scenery.setVisible(false);s.hud.setVisible(false);s.labels.setVisible(false);s.cameras.main.setBackgroundColor('#101b20');for(const o of s.children.list)if(o.type==='Text')o.setVisible(false);
   s.touch.add('W');s.touch.add('J');s.tick(.001);s.heroAnimator.tick(.001,s.y,422,false,true);s.touch.clear();
  },scenario);
  for(let frame=0;frame<92;frame++){
   await page.evaluate(({frame,scenario})=>{
    const s=window.elowen;
    if(frame===10)s.touch.add('J');
    if(frame===11)s.touch.delete('J');
    if(frame===38&&scenario!=='spin-fall'){s.touch.add('S');s.touch.add('J')}
    if(frame===39)s.touch.delete('J');
    s.tick(.02);s.heroAnimator.tick(.02,s.y,422,s.blocking,true,false,s.crouching);s.draw();
   },{frame,scenario});
   const data=await page.evaluate(()=>new Promise(resolve=>window.elowen.game.renderer.snapshotArea(365,35,570,425,img=>resolve(img.src))));
   await writeFile(`${folder}/${String(frame).padStart(2,'0')}.png`,Buffer.from(data.split(',')[1],'base64'));
  }
 }
 console.log('Captured rise, suspended follow-up, normal fall and normal/blue downward finish from the game.');
}finally{await browser.close()}
