import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.locator('#begin').click();
async function intermission(){await page.evaluate(()=>{const s=window.elowen;s.enemies=[];s.survivors=[];s.spawned=s.total;});await page.waitForFunction(()=>window.elowen.phase==='upgrade')}
async function choose(id){await page.locator(`[data-up="${id}"]`).click();await page.locator('#next-wave').click()}
async function fixture(offsets=[]){await page.evaluate(dx=>{const s=window.elowen;s.enemies=dx.map(x=>({x:s.x+x,hp:160,max:160,next:10,speed:0,kind:0}));s.survivors=[];s.timer=999;s.spawned=0;s.stamina=s.energy=s.hp=100;s.abilityCooldowns={};s.bashCd=0;s.attackCd=0;s.inv=0;s.focusTime=s.reachTime=s.crippleTime=0;s.wardTime=0;s.shots=[];s.arrows=[];s.wall=null;s.protectorCd=0;},offsets)}
async function tap(key){await page.keyboard.down(key);await page.waitForTimeout(50);await page.keyboard.up(key)}
await fixture([60]);await tap('U');assert(await page.evaluate(()=>window.elowen.stamina===100),'empty Champion slots do not activate');
await intermission();await choose('bash');
await intermission();assert.equal(await page.locator('[data-up="throw"]').count(),0,'shield alternatives mutually exclusive');
await page.evaluate(()=>window.elowen.unlockUpgrade('throw'));assert(await page.evaluate(()=>window.elowen.shieldAbility==='bash'&&!window.elowen.upgrades.includes('throw')),'alternate K ability rejected');
await choose('rally');await intermission();await choose('focus');await intermission();await choose('cripple');
assert.deepEqual(await page.evaluate(()=>window.elowen.abilitySlots),['rally','focus','cripple']);
await intermission();assert(await page.locator('[data-up="reach"]').isDisabled(),'fourth active choice disabled once U/I/O filled');
await page.evaluate(()=>window.elowen.unlockUpgrade('reach'));assert(await page.evaluate(()=>!window.elowen.upgrades.includes('reach')&&window.elowen.phase==='upgrade'),'full slots reject replacement');
assert.equal(await page.locator('select').count(),0,'no swapping controls');await choose('protector');
await intermission();await choose('focus');assert(await page.evaluate(()=>window.elowen.abilityRanks.focus===2&&window.elowen.abilitySlots[1]==='focus'),'upgrade keeps same ability and binding');
await intermission();await choose('bash');assert(await page.evaluate(()=>window.elowen.abilityRanks.bash===2&&window.elowen.shieldAbility==='bash'),'K upgrade preserves shield choice');
await fixture([60]);await tap('K');assert(await page.evaluate(()=>window.elowen.enemies[0].x>window.elowen.x+150&&window.elowen.enemies[0].stunned>1),'rank-two bash improves shove and stagger');
const bashX=await page.evaluate(()=>window.elowen.enemies[0].x);await tap('K');assert.equal(await page.evaluate(()=>window.elowen.enemies[0].x),bashX,'bash cooldown');
await fixture([200,260]);await tap('U');assert(await page.evaluate(()=>window.elowen.arrows.length>0&&window.elowen.stamina<100),'Rallying Cry calls allied arrows');await page.waitForFunction(()=>window.elowen.arrows.length===0);assert(await page.evaluate(()=>window.elowen.enemies.some(e=>e.hp<160)),'arrows deal area damage');
await fixture([35]);await page.evaluate(()=>{window.elowen.wardTime=6;window.elowen.enemies[0].next=.1});await tap('I');assert(await page.evaluate(()=>window.elowen.focusTime>9&&window.elowen.wardTime===0),'upgraded Battle Focus extends invulnerability and ends magical ward');await tap('E');assert(await page.evaluate(()=>window.elowen.energy===100&&window.elowen.shots.length===0),'Focus blocks spellcasting');
await page.waitForTimeout(200);assert(await page.evaluate(()=>window.elowen.hp===100),'Focus prevents enemy damage');await tap('J');assert(await page.evaluate(()=>window.elowen.enemies[0].hp===106),'rank-two Focus doubles sword damage');
await page.evaluate(()=>{const s=window.elowen;s.focusTime=.04;s.inv=0;s.enemies[0].x=s.x+35;s.enemies[0].next=.05});await page.waitForFunction(()=>window.elowen.hp<100);assert(await page.evaluate(()=>window.elowen.focusTime===0),'invulnerability expires');
await fixture([60]);await tap('O');await tap('J');assert(await page.evaluate(()=>window.elowen.enemies[0].hp===119.5&&window.elowen.enemies[0].rooted>2&&window.elowen.crippleTime===0),'Crippling Strike improves the next hit and roots');const rootX=await page.evaluate(()=>window.elowen.enemies[0].x);await page.evaluate(()=>window.elowen.enemies[0].speed=90);await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>window.elowen.enemies[0].x),rootX,'crippled enemy cannot move');
await fixture([45]);await page.evaluate(()=>window.elowen.survivors=[{x:window.elowen.x+40,t:0}]);const lost=await page.evaluate(()=>window.elowen.lost);await page.waitForTimeout(100);assert(await page.evaluate(()=>window.elowen.survivors.length===1&&window.elowen.enemies[0].stunned>0)&&await page.evaluate(()=>window.elowen.lost)===lost,'Protector passively intercepts a nearby survivor attack');
await fixture([300]);await page.evaluate(()=>window.elowen.survivors=[{x:window.elowen.x+300,t:0}]);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.elowen.lost),lost+1,'Protector has limited range');
await page.evaluate(()=>window.elowen.begin());assert(await page.evaluate(()=>window.elowen.shieldAbility===null&&window.elowen.abilitySlots.every(x=>x===null)&&Object.keys(window.elowen.abilityRanks).length===0),'new run clears locked choices and ranks');
await intermission();await choose('throw');await intermission();await choose('reach');
await fixture([120]);await tap('K');assert(await page.evaluate(()=>!!window.elowen.shieldFlight),'Sentinel Initiate throws shield');await page.keyboard.down('L');await page.waitForTimeout(100);assert(await page.evaluate(()=>!window.elowen.blocking),'cannot block while shield is airborne');await page.waitForFunction(()=>window.elowen.shieldFlight===null);await page.waitForTimeout(80);assert(await page.evaluate(()=>window.elowen.blocking&&window.elowen.enemies[0].hp===125),'shield deals damage, returns, and restores blocking');await page.keyboard.up('L');
await fixture([200,260]);await tap('J');assert(await page.evaluate(()=>window.elowen.enemies.every(e=>e.hp===160)),'normal sword cannot reach distant targets');await page.evaluate(()=>window.elowen.attackCd=0);await tap('U');await tap('J');assert(await page.evaluate(()=>window.elowen.enemies[0].hp===133&&window.elowen.enemies[1].hp===160),'Strike Through doubles one-handed melee range');
await page.evaluate(()=>{const s=window.elowen;s.reachTime=.01;s.attackCd=0});await page.waitForFunction(()=>window.elowen.reachTime===0);await tap('J');assert(await page.evaluate(()=>window.elowen.enemies[0].hp===133),'extended reach expires');
await fixture([]);await page.evaluate(()=>window.elowen.stamina=0);await tap('U');assert(await page.evaluate(()=>window.elowen.reachTime===0),'Champion abilities require stamina');
await page.keyboard.press('Escape');const before=await page.evaluate(()=>window.elowen.stamina);await page.locator('[data-ability-key="U"]').click();assert(await page.evaluate(()=>window.elowen.stamina)===before,'paused ability buttons are inert');await page.locator('#resume').click();
// Skipping shield talents leaves K available for a fourth permanent active ability.
await page.evaluate(()=>window.elowen.begin());
await intermission();await choose('rally');await intermission();await choose('focus');await intermission();await choose('cripple');
await intermission();assert(await page.locator('[data-up="reach"]').isEnabled(),'K remains available if no shield talent chosen');await choose('reach');
assert(await page.evaluate(()=>window.elowen.kActive==='reach'&&window.elowen.shieldAbility===null),'fourth active fills K');
await intermission();assert.equal(await page.locator('[data-up="bash"]').count(),0);assert.equal(await page.locator('[data-up="throw"]').count(),0);
await page.evaluate(()=>window.elowen.unlockUpgrade('bash'));assert(await page.evaluate(()=>window.elowen.kActive==='reach'&&window.elowen.phase==='upgrade'),'cannot replace the committed K ability');await choose('reach');
assert(await page.evaluate(()=>window.elowen.kActive==='reach'&&window.elowen.abilityRanks.reach===2),'fourth active can upgrade on K');
await fixture([200]);await tap('K');await tap('J');assert(await page.evaluate(()=>window.elowen.reachTime>10&&window.elowen.enemies[0].hp===133),'K activates upgraded Strike Through instead of a shield talent');
await page.screenshot({path:'/tmp/elowen-champion.png'});assert.deepEqual(errors,[]);
console.log('PASS: permanent K alternatives or fourth active, U/I/O capacity and bindings, ability ranks, no swaps, Rallying Cry arrows, Battle Focus damage/invulnerability/spell restriction, Crippling Strike, Protector, returning shield, doubled reach, cooldowns, stamina, pause and reset.');await browser.close();
