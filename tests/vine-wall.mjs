import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5181/');await page.locator('#begin').click();
  await page.evaluate(()=>{const s=window.elowen;s.timer=999;s.survivors=[];s.upgrades=['vines'];s.enemies=[{x:820,hp:100,max:100,next:999,speed:50,kind:0}];s.x=650;s.face=1;s.energy=100;});
  await page.keyboard.press('5');await page.waitForFunction(()=>!!window.elowen.wall);
  const cast=await page.evaluate(()=>{const s=window.elowen;return {enemyX:s.enemies[0].x,x:s.wall.x,hp:s.wall.hp,max:s.wall.max,energy:s.energy,cd:s.spellCooldowns.vines}});
  assert.equal(cast.x,780);assert.equal(cast.hp,110);assert.equal(cast.max,110);assert(cast.energy>=65&&cast.energy<67);assert(cast.cd>9.7&&cast.cd<=10);
  await page.keyboard.press('Escape');await page.locator('#resume').waitFor();
  const frozen=await page.evaluate(()=>({elapsed:window.elowen.vineWall.elapsed,fragments:window.elowen.vineWall.fragments}));await page.waitForTimeout(160);
  assert.deepEqual(await page.evaluate(()=>({elapsed:window.elowen.vineWall.elapsed,fragments:window.elowen.vineWall.fragments})),frozen);
  await page.locator('#resume').click();await page.waitForFunction(()=>window.elowen.vineWall.elapsed>3);
  await page.evaluate(()=>window.elowen.enemies[0].next=0);await page.waitForFunction(()=>window.elowen.wall.hp===98);
  assert(await page.evaluate(x=>window.elowen.vineWall.hits.length>0&&window.elowen.vineWall.fragments.length>0&&window.elowen.enemies[0].x===x,cast.enemyX),'strike animates and barrier still blocks');
  await page.screenshot({path:'wall-vines-game.png'});
  // Inspect the actual rendered barrier in isolation, including its growth and damage.
  await page.evaluate(()=>{const s=window.elowen;s.scene.pause();window.vineVisibility=s.children.list.map(c=>[c,c.visible]);s.children.list.forEach(c=>c.setVisible(c===s.art));s.wall.hp=110;s.vineWall.hits=[];s.vineWall.fragments=[];});
  async function pixels(age,hp=110,collapse=null) {
    return page.evaluate(async ({age,hp,collapse})=>{
      const s=window.elowen;s.vineWall.elapsed=age;s.wall.hp=hp;s.vineWall.collapse=collapse;s.art.clear();s.vineWall.render(s.art,422);
      const src=await new Promise(resolve=>s.game.renderer.snapshotArea(725,265,110,165,im=>resolve(im.src),'image/png'));
      const im=new Image();im.src=src;await im.decode();const canvas=document.createElement('canvas');canvas.width=110;canvas.height=165;const ctx=canvas.getContext('2d');ctx.drawImage(im,0,0);
      return [...ctx.getImageData(0,0,110,165).data];
    },{age,hp,collapse});
  }
  const anchors=await page.evaluate(()=>{
    const s=window.elowen,a=s.vineWall,result=[];s.wall.hp=110;
    for(const time of Array.from({length:a.clip.frameCount},(_,i)=>i*2.8/(a.clip.frameCount-1)+.00001)){a.elapsed=time;a.collapse=null;s.art.clear();a.render(s.art,422);const im=a.body;result.push({scaleX:im.scaleX,scaleY:im.scaleY,frame:im.frame.name,foot:im.y,origin:im.originY,anchor:a.clip.frameGroundY[im.frame.name]/im.frame.height});}
    return result;
  });
  assert(anchors.every(p=>p.scaleX===anchors[0].scaleX&&p.scaleX===p.scaleY&&p.foot===422&&p.origin===p.anchor),'fixed trunk scale and grounded roots throughout slow growth');
  assert.equal(anchors.length,24);assert.equal(new Set(anchors.map(p=>p.frame)).size,24);assert.equal(anchors.at(-1).frame,23);assert(anchors[4].frame<=4,'growth progresses gradually through new intermediate poses');
  const seed=await pixels(.02),growing=await pixels(1.1),mature=await pixels(3),sway=await pixels(4.1),damaged=await pixels(3,20),fall=await pixels(3,0,.4);
  const changes=(a,b)=>{let count=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>15)count++;return count;};
  assert(changes(seed,growing)>400,'stems visibly emerge');assert(changes(growing,mature)>400,'foliage unfurls');assert(changes(mature,sway)>20,'living wall sways');assert(changes(mature,damaged)>400,'damage wilts and darkens the wall');assert(changes(mature,fall)>800,'destroyed vines visibly collapse');
  await page.evaluate(()=>{const s=window.elowen;window.vineVisibility.forEach(([c,v])=>c.setVisible(v));s.vineWall.collapse=null;s.wall.hp=1;s.enemies[0].next=0;s.scene.resume();});
  await page.waitForFunction(()=>window.elowen.wall===null);
  assert(await page.evaluate(()=>window.elowen.vineWall.collapse!==null&&window.elowen.vineWall.barrier!==null),'collision ends immediately while the plant collapses');
  await page.waitForFunction(()=>!window.elowen.vineWall.barrier&&!window.elowen.vineWall.fragments.length);
  await page.waitForFunction(()=>window.elowen.enemies[0].x<775);
  const placements=await page.evaluate(()=>{
    const s=window.elowen;s.paused=true;s.enemies=[];const results=[];
    for(const [x,face] of [[650,1],[650,-1],[355,-1],[1000,1]]){s.x=x;s.face=face;s.energy=100;s.spellCooldowns={};s.cast('vines');results.push(s.wall.x);}
    return results;
  });assert.deepEqual(placements,[780,520,380,1130]);
  const replacement=await page.evaluate(()=>{const s=window.elowen,old=s.wall;s.vineWall.strike(1);s.vineWall.destroy();s.energy=100;s.spellCooldowns={};s.cast('vines');return s.wall!==old&&s.vineWall.barrier===s.wall&&s.vineWall.collapse===null&&s.vineWall.hits.length===0&&s.wall.hp===110;});assert(replacement);
  const gates=await page.evaluate(()=>{
    const s=window.elowen,results=[];
    for(const gate of ['locked','energy','shield','focus','cooldown']){
      s.wall=null;s.vineWall.reset();s.upgrades=gate==='locked'?[]:['vines'];s.energy=gate==='energy'?20:100;s.blocking=gate==='shield';s.focusTime=gate==='focus'?1:0;s.spellCooldowns=gate==='cooldown'?{vines:2}:{};const before=s.energy;s.cast('vines');results.push(s.wall===null&&s.vineWall.barrier===null&&s.energy===before);
    }s.blocking=false;s.focusTime=0;return results;
  });assert(gates.every(Boolean));
  for(const method of ['startWave','beginEnding','end','begin']) {
    assert(await page.evaluate(method=>{const s=window.elowen;s.phase='play';s.upgrades=['vines'];s.energy=100;s.spellCooldowns={};s.cast('vines');s.vineWall.strike(1);s[method](false);return !s.wall&&!s.vineWall.barrier&&!s.vineWall.fragments.length&&!s.vineWall.hits.length;},method),method+' clears animation');
  }
  await page.goto(new URL('wall-of-vines/',process.env.GAME_URL||'http://127.0.0.1:5181/').href);
  await page.waitForFunction(()=>window.vinePreviewReady===true);await page.locator('#restart').click();await page.locator('#pause').click();assert.equal(await page.locator('#pause').textContent(),'Resume');
  assert.deepEqual(errors,[]);console.log('PASS: 24 distinct growth frames, continuous blending, fixed-scale growth, textured intertwined trunks, grounded frames, unfolding leaves, idle sway, hit reaction, damaged foliage, collapse/debris, immediate collision removal, movement resumes, key 5, cost/cooldown/gates, placement, replacement, pause and lifecycle cleanup.');
} finally {await browser.close();}
