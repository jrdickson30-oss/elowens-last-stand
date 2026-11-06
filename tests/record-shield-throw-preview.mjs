import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try {
 const page=await browser.newPage();await page.goto(process.env.GAME_URL);await page.locator('#begin').click({timeout:90000});
 const folder=(process.env.PREVIEW_DIR||'../downloads/shield-throw')+'/frames';await mkdir(folder,{recursive:true});
 await page.evaluate(()=>{const s=window.elowen;if(!s.heroAnimator.clips.shieldThrow||!s.heroAnimator.clips.unshieldedUtility)throw new Error('Shield Throw artwork did not load');s.begin();s.paused=true;s.timer=999;s.spawned=0;s.survivors=[];s.x=470;s.face=1;s.shieldAbility='throw';s.upgrades=['throw'];s.enemies=[620,740].map(x=>({x,hp:160,max:160,next:999,speed:0,kind:0}));s.hud.setVisible(false);s.labels.setVisible(false);for(const o of s.children.list)if(o.type==='Text')o.setVisible(false)});
 const trace=[];
 for(let frame=0;frame<140;frame++){
  trace.push(await page.evaluate(frame=>{const s=window.elowen;if(frame===8)s.activateAbilityKey('K');s.tick(.02);s.heroAnimator.tick(.02,s.y,422,false,true);s.draw();return {frame,hero:s.heroAnimator.pose(0),away:s.heroAnimator.shieldAway,shield:s.shieldFlight?{x:s.shieldFlight.x,y:s.shieldFlight.y,released:s.shieldFlight.released,returning:s.shieldFlight.returning}:null}},frame));
  const png=await page.evaluate(()=>new Promise(resolve=>window.elowen.game.renderer.snapshotArea(365,285,550,170,img=>resolve(img.src))));
  await writeFile(`${folder}/${String(frame).padStart(3,'0')}.png`,Buffer.from(png.split(',')[1],'base64'));
 }
 await writeFile(folder+'/../capture-trace.json',JSON.stringify(trace,null,2));
 console.log('Captured the hand release, spinning outbound shield, enemy hits, return and catch from the actual game.');
} finally {await browser.close()}
