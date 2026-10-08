import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL);await page.locator('#begin').click();
 await page.evaluate(()=>{const s=window.elowen;s.paused=true;s.timer=999;s.enemies=[];s.survivors=[];s.upgrades.push('ward');s.cast('ward');s.draw()});
 const initial=await page.evaluate(()=>{const s=window.elowen,w=s.warriorShield;return {remaining:s.wardTime,visible:w.front.visible&&w.back.visible,x:w.front.x,y:w.front.y,r:w.radius,offset:w.centreOffset,scaleX:w.front.scaleX,scaleY:w.front.scaleY,backDepth:w.back.depth,frontDepth:w.front.depth}});
 assert.equal(initial.remaining,6);assert(initial.visible);assert.equal(initial.scaleX,initial.scaleY);assert(initial.backDepth<1&&initial.frontDepth>1);
 assert(Math.hypot(40,initial.offset)<initial.r,'both spread feet fit inside the circular dome');
 const pixels=await page.evaluate(()=>{const s=window.elowen,w=s.warriorShield;const snapshot=time=>{w.render(s.x,s.y,time,true);return Array.from(s.textures.get('warrior-shield-front').context.getImageData(0,0,256,256).data)};return [snapshot(6),snapshot(4)]});
 assert(pixels[1].filter((p,i)=>i%4===3&&p>pixels[0][i]).length>100,'shimmer crosses the front surface');
 await page.evaluate(()=>{const s=window.elowen;s.wardTime=4;s.draw()});await page.screenshot({path:'warrior-shield-game.png'});
 const frozen=await page.evaluate(()=>window.elowen.warriorShield.front.getData('shieldElapsed'));await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.elowen.warriorShield.front.getData('shieldElapsed')),frozen);
 const follow=await page.evaluate(()=>{const s=window.elowen,w=s.warriorShield;s.x=720;s.y=340;s.crouching=true;s.face=-1;s.draw();return {x:w.front.x,y:w.front.y,r:w.radius}});assert.equal(follow.x,720);assert(Math.abs(follow.y-(340-initial.offset))<.001);assert.equal(follow.r,initial.r);
 const damage=await page.evaluate(()=>{const s=window.elowen;s.hp=100;s.wardTime=4;s.takeDamage(20,true);return s.hp});assert.equal(damage,90);
 await page.evaluate(()=>{const s=window.elowen;s.wardTime=.02;s.crouching=false;s.y=422;s.tick(.04);s.draw()});assert(await page.evaluate(()=>!window.elowen.warriorShield.front.visible&&!window.elowen.warriorShield.back.visible));
 await page.evaluate(()=>{const s=window.elowen;s.wardTime=4;s.phase='dead';s.draw()});assert(await page.evaluate(()=>!window.elowen.warriorShield.front.visible));
 await page.evaluate(()=>window.elowen.begin());assert(await page.evaluate(()=>window.elowen.wardTime===0&&!window.elowen.warriorShield.front.visible));
 assert.deepEqual(errors,[]);console.log('PASS: round shield, both feet enclosed, layers around hero, periodic front shimmer, pause, movement/jump/crouch/facing, six-second expiry, existing damage reduction, death and restart.');
}finally{await browser.close()}
