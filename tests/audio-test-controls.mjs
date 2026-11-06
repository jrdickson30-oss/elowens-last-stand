import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const base=process.env.GAME_URL||'http://127.0.0.1:5173';
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.audioAudit={files:[],played:[],failed:[],voices:[]};
  const load=HTMLMediaElement.prototype.load,play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.load=function(){window.audioAudit.files.push(this.src);return load.call(this)};
  HTMLMediaElement.prototype.play=function(){
   window.audioAudit.voices.push(this);
   const result=play.call(this);
   result.then(()=>window.audioAudit.played.push(this.src),error=>window.audioAudit.failed.push(error.message));
   return result;
  };
 });
 await page.goto(base);await page.locator('#begin').waitFor({timeout:90000});
 assert.equal(await page.locator('#sound').textContent(),'SOUND OFF');
 await page.locator('#sound').click();
 const decoded=await page.evaluate(async()=>{
  const context=new AudioContext(),files=[...new Set(window.audioAudit.files)];
  for(const file of files){const response=await fetch(file);if(!response.ok)throw Error(`Missing audio: ${file}`);const clip=await context.decodeAudioData(await response.arrayBuffer());if(!clip.duration)throw Error(`Empty audio: ${file}`)}
  await context.close();return files.length;
 });
 assert(decoded>=50,'all selected WAV and OGG effects load and decode');
 await page.locator('.test-toggle').click();
 await page.locator('[data-test-level]').selectOption('3');await page.locator('[data-test-wave]').selectOption('2');await page.locator('[data-test-jump]').click();
 assert(await page.evaluate(()=>window.elowen.level===3&&window.elowen.wave===2&&window.elowen.phase==='play'));
 await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.enemies=[];s.survivors=[];s.upgrades=['ward'];s.abilitySlots=['rally',null,null];s.abilityRanks={ward:2};});
 const build=await page.evaluate(()=>JSON.stringify([window.elowen.upgrades,window.elowen.abilitySlots,window.elowen.abilityRanks,window.elowen.shieldAbility]));
 await page.locator('[data-test-ability="ice"]').check();await page.locator('[data-test-use="ice"]').click();
 await page.waitForFunction(()=>window.audioAudit.played.some(url=>url.includes('Projectile_Launch')));
 await page.evaluate(()=>{const s=window.elowen;s.explodeIce({x:s.x+150,y:378,dir:1,spell:'ice',life:.8,damage:48});});
 await page.locator('[data-test-ability="reach"]').check();await page.locator('[data-test-use="reach"]').click();
 assert(await page.evaluate(()=>window.elowen.reachTime>0));
 assert.equal(await page.evaluate(()=>JSON.stringify([window.elowen.upgrades,window.elowen.abilitySlots,window.elowen.abilityRanks,window.elowen.shieldAbility])),build,'test unlocks preserve the real build');
 await page.locator('.test-toggle').click();
 assert(await page.evaluate(()=>!window.elowen.testMode&&!window.elowen.unlocked('ice')&&window.elowen.testAbilities.size===0));
 await page.keyboard.press('J');await page.waitForFunction(()=>window.audioAudit.played.some(url=>url.includes('Dagger_Swing')));
 await page.keyboard.down('D');await page.waitForFunction(()=>window.audioAudit.played.some(url=>url.includes('footstep_')));await page.keyboard.up('D');
 await page.keyboard.press('W');await page.waitForFunction(()=>window.audioAudit.played.some(url=>url.includes('boots-leather-jump')));
 await page.locator('#sound').click();assert(await page.evaluate(()=>window.audioAudit.voices.every(voice=>voice.paused)),'mute immediately stops active effects');
 const count=await page.evaluate(()=>window.audioAudit.voices.length);await page.keyboard.press('J');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.audioAudit.voices.length),count);
 await page.locator('.test-toggle').click();
 for(const phase of ['ending','win','dead']){
  await page.evaluate(phase=>{const s=window.elowen;s.phase=phase;s.heroSacrificed=true;s.bridgeDestroyed=true;s.endingTime=10;},phase);
  await page.locator('[data-test-level]').selectOption('2');await page.locator('[data-test-jump]').click();
  assert(await page.evaluate(()=>window.elowen.phase==='play'&&!window.elowen.heroSacrificed&&!window.elowen.bridgeDestroyed&&window.elowen.hp>0),'level navigation revives Elowen after an ended run');
 }
 assert.deepEqual(await page.evaluate(()=>window.audioAudit.failed),[]);assert.deepEqual(errors,[]);
 await page.close();
 const mobile=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 await mobile.goto(base);await mobile.locator('#begin').click({timeout:90000});
 await mobile.locator('.test-sound').tap();assert.equal(await mobile.locator('.test-sound').textContent(),'SOUND ON');
 await mobile.locator('.touch-pause').tap();await mobile.waitForFunction(()=>window.elowen.paused);await mobile.locator('#resume').tap();
 await mobile.locator('.test-toggle').tap();assert(await mobile.locator('.test-body').isVisible());await mobile.locator('.test-toggle').tap();
 assert(await mobile.evaluate(()=>{const r=document.querySelector('.test-heading').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}));
 await mobile.close();
 console.log(`PASS: ${decoded} audio clips decoded, real spell/sword/jump/footstep playback, mute, temporary unlocks, level/wave jumps, ending recovery and mobile sound/test/pause access.`);
} finally {await browser.close()}
