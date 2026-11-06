import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try {
 const page=await browser.newPage();await page.goto(process.env.GAME_URL);await page.locator('#begin').click({timeout:90000});
 const folder=(process.env.PREVIEW_DIR||'../downloads/ice-lance-soft-fade')+'/frames';await mkdir(folder,{recursive:true});
 await page.evaluate(()=>{const s=window.elowen;if(!s.heroAnimator.clips.ice)throw new Error('Ice casting artwork did not load');s.begin();s.paused=true;s.timer=999;s.spawned=0;s.survivors=[];s.x=470;s.face=1;s.upgrades=['ice'];s.enemies=[765,825].map(x=>({x,hp:160,max:160,next:999,speed:0,kind:0}));s.hud.setVisible(false);s.labels.setVisible(false);for(const o of s.children.list)if(o.type==='Text')o.setVisible(false)});
 const trace=[];
 for(let frame=0;frame<160;frame++){
  trace.push(await page.evaluate(frame=>{const s=window.elowen;if(frame===6)s.cast('ice');s.tick(.02);s.heroAnimator.tick(.02,s.y,422,false,true);s.draw();return {frame,pose:s.heroAnimator.pose(0),beam:s.iceLance.beams.map(beam=>({origin:beam.origin,tip:{x:beam.shot.x,y:beam.shot.y}}))}},frame));
  const png=await page.evaluate(()=>new Promise(resolve=>window.elowen.game.renderer.snapshotArea(365,230,550,225,img=>resolve(img.src))));
  await writeFile(`${folder}/${String(frame).padStart(3,'0')}.png`,Buffer.from(png.split(',')[1],'base64'));
 }
 await writeFile(folder+'/../capture-trace.json',JSON.stringify(trace,null,2));
 console.log('Captured shield raising, spreading frost, ice beam and crystalline impact from the actual game.');
} finally {await browser.close()}
