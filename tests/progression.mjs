import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1200}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');
await page.locator('#begin').click();

// Expected values transcribed from the core rules' milestone tables, with
// the documented starting values and fixed average weapon dice adaptation.
const levels=[
  [1,100,'Novice',1,0,27,0],
  [2,112,'Apprentice',2,1,32.5,1],
  [3,124,'Apprentice',2,1,32.5,1],
  [4,136,'Apprentice',2,1,32.5,1],
  [5,148,'Journeyman',3,1,32.5,1],
  [6,160,'Journeyman',3,1,32.5,1],
  [7,172,'Journeyman',3,1,32.5,1],
  [8,184,'Hero',4,2,38,2],
  [9,196,'Hero',4,2,38,2],
  [10,208,'Legend',5,3,43.5,2],
];
const choices=['bash','bash','bash','protector','protector','protector','rally','rally','rally'];

for(const [index,expected] of levels.entries()){
 assert.deepEqual(await page.evaluate(()=>{const s=window.elowen,p=s.progression;return [s.level,s.maxHp,p.tier,p.proficiencyBonus,p.bonusWeaponDice,s.damage,p.armourBonus]}),expected);
 assert.equal(await page.evaluate(()=>window.elowen.wave),1,'each level starts on wave one');
 const environment=expected[0]<=2?'town':expected[0]<=5?'grasslands':expected[0]<=8?'road':'bridge';
 assert.equal(await page.evaluate(()=>window.elowen.scenery.getData('environment')),environment,'campaign environment matches level');
 assert(!/PB|AR|Proficiency|dice/.test(await page.evaluate(()=>window.elowen.data.get('statusText').text)),'HUD contains no rules statistics');
 await page.evaluate(()=>{const s=window.elowen;s.survivors=[];s.timer=999;s.spawned=0;s.enemies=[{x:s.x+60,hp:1000,max:1000,next:999,speed:0,kind:0}];s.attackCd=0;s.hp=s.maxHp;});
 await page.keyboard.down('J');await page.waitForFunction(()=>window.elowen.enemies[0].hp<1000);await page.keyboard.up('J');
 assert.equal(await page.evaluate(()=>window.elowen.enemies[0].hp),1000-expected[5],'milestone damage affects actual sword hits');
 await page.evaluate(()=>{const s=window.elowen;s.hp=s.maxHp;s.inv=0;s.enemies[0].x=s.x+35;s.enemies[0].next=0;});
 await page.waitForFunction(()=>window.elowen.hp<window.elowen.maxHp);
 assert.equal(await page.evaluate(()=>window.elowen.hp),expected[1]-11+expected[6],'armour reduces actual enemy attacks');
 assert(await page.evaluate(()=>{const s=window.elowen;s.hp=s.maxHp;s.wardTime=6;s.takeDamage(20,true);return s.hp===s.maxHp-(20-s.progression.armourBonus)/2}),'armour and magical ward combine once');
 assert(await page.evaluate(()=>{const s=window.elowen;s.hp=s.maxHp;s.wardTime=0;s.focusTime=2;s.takeDamage(20,true);return s.hp===s.maxHp}),'Focus still prevents damage');
 await page.evaluate(()=>{const s=window.elowen;s.focusTime=0;s.hp=s.maxHp-40;s.enemies=[];s.survivors=[];s.spawned=s.total;});
 // Clear all three waves; only the third allows a character-level upgrade.
 for(const wave of [2,3]){
  await page.waitForFunction(()=>window.elowen.phase==='wavebreak');
  assert.equal(await page.locator('[data-up]').count(),0,'no ability choices between waves inside a level');
  const hp=await page.evaluate(()=>window.elowen.hp);
  await page.locator('#continue-wave').click();
  assert.deepEqual(await page.evaluate(()=>{const s=window.elowen;return [s.level,s.wave,s.maxHp,s.damage]}),[expected[0],wave,expected[1],expected[5]],'waves do not grant levels or milestone bonuses');
  assert.equal(await page.evaluate(()=>window.elowen.hp),hp,'health is not healed again at each wave');
  assert.equal(await page.evaluate(()=>window.elowen.total),5+expected[0]*3+(wave-1)*2,'later waves add enemies');
  await page.evaluate(()=>{const s=window.elowen;s.enemies=[];s.survivors=[];s.spawned=s.total;s.timer=999});
 }
 if(index===9){
  await page.waitForFunction(()=>window.elowen.phase==='ending');
  assert.equal(await page.locator('[data-up]').count(),0,'final level begins the sacrifice without another upgrade');
  await page.waitForFunction(()=>window.elowen.bridgeDestroyed);await page.keyboard.press('J');await page.keyboard.press('E');
  await page.waitForFunction(()=>window.elowen.phase==='win');
  assert(await page.evaluate(()=>window.elowen.bridgeDestroyed&&window.elowen.heroSacrificed&&window.elowen.hp===0),'sacrifice is a story victory despite zero health');
  assert(await page.getByText('Her last stand. Their tomorrow.',{exact:true}).isVisible(),'sacrifice epilogue appears');break
 }
 await page.waitForFunction(()=>window.elowen.phase==='upgrade');
 assert.equal(await page.evaluate(()=>window.elowen.level),expected[0],'opening upgrade menu does not grant a level twice');
 assert(await page.getByText(`LEVEL ${expected[0]+1} · ${levels[index+1][2].toUpperCase()}`,{exact:false}).first().isVisible(),'upcoming level is shown');
 await page.locator(`[data-up="${choices[index]}"]`).click();await page.locator('#next-wave').click();
 assert.equal(await page.evaluate(()=>window.elowen.hp),levels[index+1][1]-18,'level growth adds 12 current SP, then heals 22, without fully healing injuries');
}
assert.equal(await page.locator('[data-up]').count(),0,'winning at level ten grants no extra upgrade');
await page.getByRole('button',{name:'STAND AGAIN'}).click();
assert.deepEqual(await page.evaluate(()=>{const s=window.elowen;return [s.level,s.maxHp,s.hp,s.damage,s.progression.armourBonus]}),[1,100,100,27,0],'restart clears all progression bonuses');
assert(await page.evaluate(()=>!window.elowen.bridgeDestroyed&&!window.elowen.heroSacrificed&&window.elowen.scenery.getData('environment')==='town'),'restart restores Elowen and town scenery');
await page.screenshot({path:'/tmp/elowen-progression.png'});assert.deepEqual(errors,[]);
console.log('PASS: 30 waves across ten levels, four environments, simple HUD, sacrifice ending, SP growth and recovery, source milestone tiers, actual sword damage and armour, ward/Focus interactions, nine permanent upgrade choices, final victory and reset.');
await browser.close();
