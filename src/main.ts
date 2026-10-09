import Phaser from 'phaser';
import { TouchControls, bindTouchAction } from './touch-controls';
import { WarriorShield } from './warrior-shield';
import './style.css';
import { basicGraphics, loadingProgress, startupComplete, startupFailed } from './startup';
import { championProgression, MAX_LEVEL } from './progression';
import { chapterForLevel, WAVES_PER_LEVEL, enemyCount } from './campaign';
import { buildEnvironment } from './environments';
import { SCENE_ART, updateEnvironment } from './ambience';
import { HeroAnimator, preloadHeroActions, SWORD_INTERVAL, SWORD_RANGE } from './hero-animation';
import { VillagerAnimator, preloadVillagers } from './villager-animation';
import { SPELLS, type SpellId } from './spells';
import { CHAMPION_ABILITIES, ABILITY_SLOTS, isActiveAbility, type ChampionId, type ActiveAbilityId } from './abilities';
const W=1280,H=720,G=422;
type Enemy={x:number,hp:number,max:number,next:number,speed:number,kind:number;stunned?:number;rooted?:number};
type Survivor={x:number,t:number,villager:string};
type Shot={x:number,y:number,dir:number,life:number,spell:SpellId,damage:number};
type Particle={x:number,y:number,vx:number,vy:number,life:number,color:number};
type IdleMetadata={frameWidth:number,frameHeight:number,frameCount:number,durationsMs:number[],columns?:number,footAnchors?:number[]};
const overlay=document.querySelector<HTMLDivElement>('#overlay')!;
let muted=true;
let audio:AudioContext|undefined;
function tone(freq:number,duration=.08){if(muted)return;audio??=new AudioContext();void audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.value=freq;o.connect(g);g.connect(audio.destination);g.gain.setValueAtTime(.04,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.start();o.stop(audio.currentTime+duration);}
document.querySelector('#sound')!.addEventListener('click',()=>{muted=!muted;document.querySelector('#sound')!.textContent=muted?'SOUND OFF':'SOUND ON';tone(440)});
class Stand extends Phaser.Scene{
 spritePool:Phaser.GameObjects.Image[]=[];spriteIndex=0;art!:Phaser.GameObjects.Graphics;hud!:Phaser.GameObjects.Graphics;labels!:Phaser.GameObjects.Text;keys!:Record<string,Phaser.Input.Keyboard.Key>;
 touchControls?:TouchControls;
 warriorShield!:WarriorShield;
 pendingEmber:{delay:number;face:number;damage:number}|null=null;
 phase='title';wave=1;x=500;y=G;vy=0;face=1;hp=100;stamina=100;energy=100;spellDamage=43;shieldCost=14;rescued=0;lost=0;kills=0;spawned=0;total=0;timer=0;clock=0;swing=0;attackCd=0;inv=0;blocking=false;crouching=false;enemies:Enemy[]=[];survivors:Survivor[]=[];shots:Shot[]=[];particles:Particle[]=[];paused=false;touch=new Set<string>();upgrades:string[]=[];waveKills=0;
 scenery!:Phaser.GameObjects.Container;sceneryLevel=0;ambientTime=0;
 endingTime=0;bridgeDestroyed=false;heroSacrificed=false;
 idleFrame=0;idleElapsed=0;idleDurations:number[]=[];heroAnimator!:HeroAnimator;villagerAnimator!:VillagerAnimator;
 progression=championProgression(1);
 get level(){return this.progression.level}
 get maxHp(){return this.progression.maxHealth}
 get damage(){return this.progression.swordDamage}
 applyLevel(level:number){const next=championProgression(level);this.hp=Math.min(next.maxHealth,this.hp+Math.max(0,next.maxHealth-this.maxHp));this.progression=next}
 levelUpSummary(){const next=championProgression(this.level+1),current=this.progression;return `<p>LEVEL ${next.level} · ${next.tier.toUpperCase()}<br>SP ${current.maxHealth} → ${next.maxHealth} · Sword ${current.swordDamage} → ${next.swordDamage}<br>${chapterForLevel(next.level).location} · ${chapterForLevel(next.level).title}</p>`}
 spellCooldowns:Partial<Record<SpellId,number>>={};wardTime=0;bashTime=0;
 wall:{x:number,hp:number,max:number}|null=null;previousKeys=new Set<string>();pendingPress=new Set<string>();
 shieldAbility:'bash'|'throw'|null=null;kActive:ActiveAbilityId|null=null;abilitySlots:(ActiveAbilityId|null)[]=[null,null,null];
 abilityRanks:Partial<Record<ChampionId,number>>={};abilityCooldowns:Partial<Record<ChampionId,number>>={};focusTime=0;reachTime=0;crippleTime=0;protectorCd=0;
 shieldFlight:{x:number,y:number,dir:number,originX:number,returning:boolean,hits:Set<Enemy>}|null=null;
 arrows:{targetX:number,delay:number,progress:number}[]=[];
 hotbar!:HTMLDivElement;championbar!:HTMLDivElement;message='';messageTime=0;
 preload(){this.load.on('progress',loadingProgress);preloadHeroActions(this);preloadVillagers(this);this.load.image('wind-bough',new URL('scene-art/wind-bough.png',document.baseURI).href);for(const art of SCENE_ART){const url=new URL('scene-art/'+art.file,document.baseURI);if(art.revision)url.searchParams.set('v',art.revision);this.load.image(art.key,url.href);}this.load.image('forest',new URL('forest.png',document.baseURI).href);this.load.image('characters',new URL('characters.png',document.baseURI).href);this.load.image('elowen',new URL('elowen.png',document.baseURI).href);this.load.image('elowen-idle',new URL('elowen-idle/Elowen-idle-spritesheet.png?v=palette2',document.baseURI).href);this.load.json('elowen-idle-meta',new URL('elowen-idle/Elowen-idle.json?v=palette2',document.baseURI).href)}
 create(){this.background();if(this.textures.exists('characters')){const tex=this.textures.get('characters');const src=tex.getSourceImage() as HTMLImageElement;const canvas=document.createElement('canvas');canvas.width=src.width;canvas.height=src.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(src,0,0);const pixels=ctx.getImageData(0,0,src.width,src.height).data;for(let f=0;f<4;f++){let minX=src.width,minY=src.height,maxX=0,maxY=0;for(let y=0;y<src.height;y++)for(let x=Math.floor(f*src.width/4);x<Math.floor((f+1)*src.width/4);x++){if(pixels[(y*src.width+x)*4+3]>90){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}}tex.add('figure'+f,0,minX,minY,maxX-minX+1,maxY-minY+1)}}if(this.textures.exists('elowen')){
 const texture=this.textures.get('elowen'),source=texture.getSourceImage() as HTMLImageElement;
 const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;const context=canvas.getContext('2d')!;context.drawImage(source,0,0);
 const pixels=context.getImageData(0,0,source.width,source.height).data;let left=source.width,top=source.height,right=0,bottom=0;
 for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(pixels[(y*source.width+x)*4+3]>90){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}
 if(right>=left&&bottom>=top)texture.add('hero',0,left,top,right-left+1,bottom-top+1);
}this.createIdleFrames();this.heroAnimator=new HeroAnimator(this);this.warriorShield=new WarriorShield(this);this.villagerAnimator=new VillagerAnimator(this);this.art=this.add.graphics().setDepth(2);this.hud=this.add.graphics().setDepth(3);this.labels=this.add.text(35,26,'',{fontFamily:'Arial',fontSize:'12px',color:'#dedaca',lineSpacing:8}).setDepth(10);this.keys=this.input.keyboard!.addKeys('A,D,S,W,J,K,L,E,ONE,TWO,THREE,FOUR,FIVE,U,I,O,ESC') as Record<string,Phaser.Input.Keyboard.Key>;this.input.keyboard!.addCapture(['W','A','D','S','J','K','L','E','ONE','TWO','THREE','FOUR','FIVE','U','I','O']);for(const key of [...SPELLS.map(s=>s.key),'K',...ABILITY_SLOTS,'ESC'])this.keys[key].on('down',()=>this.pendingPress.add(key));this.createHotbar();this.controls();this.touchControls!.update(this.phase,this.paused);this.title();startupComplete();(window as unknown as {elowen:Stand}).elowen=this;}
 createIdleFrames(){
  if(!this.textures.exists('elowen-idle'))return;
  const meta=this.cache.json.get('elowen-idle-meta') as IdleMetadata|undefined;
  if(!meta)return;
  const texture=this.textures.get('elowen-idle'),source=texture.getSourceImage() as HTMLImageElement;
  const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
  const context=canvas.getContext('2d')!;context.drawImage(source,0,0);
  const pixels=context.getImageData(0,0,source.width,source.height).data;
  let left=meta.frameWidth,top=meta.frameHeight,right=-1,bottom=-1;
  // Use one shared crop: trimming each pose separately would move her feet and change her scale.
  for(let frame=0;frame<meta.frameCount;frame++)for(let y=0;y<meta.frameHeight;y++)for(let x=0;x<meta.frameWidth;x++){
   const col=frame%(meta.columns??meta.frameCount),row=Math.floor(frame/(meta.columns??meta.frameCount));
   if(pixels[((row*meta.frameHeight+y)*source.width+col*meta.frameWidth+x)*4+3]>90){const anchoredY=y-(meta.footAnchors?.[frame]??meta.frameHeight);left=Math.min(left,x);top=Math.min(top,anchoredY);right=Math.max(right,x);bottom=Math.max(bottom,anchoredY)}
  }
  if(right<left||bottom<top)return;
  for(let frame=0;frame<meta.frameCount;frame++)texture.add('idle'+frame,0,(frame%(meta.columns??meta.frameCount))*meta.frameWidth+left,Math.floor(frame/(meta.columns??meta.frameCount))*meta.frameHeight+(meta.footAnchors?.[frame]??meta.frameHeight)+top,right-left+1,bottom-top+1);
  this.idleDurations=meta.durationsMs.map(ms=>ms/1000);
 }
 tickHeroAnimation(dt:number){
  if(this.paused)return;
  this.heroAnimator.tick(dt,this.y,G,this.blocking,this.phase==='play',this.down('A')!==this.down('D')&&this.x>355&&this.x<1000,this.crouching);
  if(!this.idleDurations.length)return;
  const idle=this.phase==='title'||(this.phase==='play'&&this.y===G&&!this.down('A')&&!this.down('D')&&!this.down('J')&&!this.crouching&&!this.blocking&&this.swing<=0&&this.bashTime<=0&&!this.shieldFlight&&!this.heroAnimator.pose(this.vy));
  if(!idle){this.idleFrame=0;this.idleElapsed=0;return}
  this.idleElapsed+=dt;
  while(this.idleElapsed>=this.idleDurations[this.idleFrame]){this.idleElapsed-=this.idleDurations[this.idleFrame];this.idleFrame=(this.idleFrame+1)%this.idleDurations.length}
 }
 background(){this.scenery?.destroy(true);this.scenery=buildEnvironment(this,this.level);this.sceneryLevel=this.level}

 title(){overlay.innerHTML=`<div class="panel"><div class="gold">THE LAST LIGHT AT GREYFALL</div><h2>They’re counting on you.</h2><p>The dead are coming. Help Greyfall’s refugees escape the town.<br>Your sword is their last defence. Your Chaos is their last hope.</p><button class="primary" id="begin">TAKE YOUR STAND →</button><p>Ten levels · Three waves each · One last stand</p></div>`;document.querySelector('#begin')!.addEventListener('click',()=>this.begin());}
 controls(){this.touchControls??=new TouchControls(this.touch,this.pendingPress)}
 begin(){this.touchControls?.clear();this.touch.clear();this.progression=championProgression(1);this.hp=this.stamina=this.energy=100;this.x=500;this.y=G;this.vy=0;this.wave=1;this.endingTime=0;this.bridgeDestroyed=this.heroSacrificed=false;this.sceneryLevel=0;this.rescued=this.lost=this.kills=0;this.spellDamage=43;this.shieldCost=14;this.upgrades=[];this.shieldAbility=null;this.kActive=null;this.abilitySlots=[null,null,null];this.abilityRanks={};this.abilityCooldowns={};this.focusTime=this.reachTime=this.crippleTime=this.protectorCd=0;this.shieldFlight=null;this.arrows=[];this.shots=[];this.pendingEmber=null;this.particles=[];this.attackCd=this.inv=this.swing=0;this.idleFrame=this.idleElapsed=0;this.heroAnimator.reset();this.paused=false;this.spellCooldowns={};this.wardTime=this.bashTime=0;this.wall=null;this.previousKeys.clear();this.pendingPress.clear();this.message='';this.messageTime=0;this.controls();this.startWave();}
 startWave(){this.heroAnimator.reset();if(this.sceneryLevel!==this.level)this.background();overlay.innerHTML='';this.phase='play';this.enemies=[];this.survivors=this.villagerAnimator.choose(5).map((villager,i)=>({x:680+i*90,t:Math.random()*.6,villager}));this.spawned=0;this.waveKills=0;this.wall=null;this.wardTime=this.focusTime=this.reachTime=this.crippleTime=0;this.shieldFlight=null;this.arrows=[];this.shots=[];this.pendingEmber=null;this.abilityCooldowns={};this.spellCooldowns={};this.total=enemyCount(this.level,this.wave);this.timer=1.4;this.clock=0;this.energy=100;this.stamina=100;}
 down(k:string){return this.keys[k].isDown||this.touch.has(k)}
 burst(x:number,y:number,color:number,n=12){for(let i=0;i<n;i++)this.particles.push({x,y,vx:Phaser.Math.Between(-140,140),vy:Phaser.Math.Between(-180,40),life:Phaser.Math.FloatBetween(.2,.65),color})}
 hurt(e:Enemy,d:number,dir=this.face){if(e.hp<=0)return;e.hp-=d;this.burst(e.x,G-40,0xb8c78b,8);e.x+=dir*15;if(e.hp<=0){this.kills++;this.waveKills++;this.burst(e.x,G-30,0xc69d57,16);tone(100)}}
 hasActiveSlot(){return this.abilitySlots.includes(null)||(!this.shieldAbility&&!this.kActive)}
 nextActiveKey(){const empty=this.abilitySlots.indexOf(null);return empty>=0?ABILITY_SLOTS[empty]:'K'}
 rank(id:ChampionId){return this.abilityRanks[id]??1}
 abilityCooldown(id:ChampionId){const ability=CHAMPION_ABILITIES.find(a=>a.id===id)!;return id==='rally'?ability.cooldown-2*(this.rank(id)-1):ability.cooldown}
 abilityKey(id:ChampionId){return id==='bash'||id==='throw'?'K':id==='protector'?'PASSIVE':this.kActive===id?'K':ABILITY_SLOTS[this.abilitySlots.indexOf(id as ActiveAbilityId)]??'U / I / O / K'}
 rankDescription(id:ChampionId){return {
  bash:'Each rank adds 20 px shove distance and 0.3 seconds stagger.',
  throw:'Each rank adds 10 shield damage and 60 px throw range.',
  protector:'Each rank extends protection by 30 px and improves interception recovery.',
  rally:'Each rank reduces the cooldown by two seconds (10 / 8 / 6 seconds), adds three arrows and +5 damage per arrow.',
  focus:'Each rank adds two seconds of invulnerability and +25% sword damage.',
  cripple:'Each rank adds one second immobilisation and +25% next-hit damage.',
  reach:'Each rank adds three seconds of doubled melee reach.'
 }[id]}
 upgrade(){
  this.phase='upgrade';
  const champions=CHAMPION_ABILITIES.filter(a=>!(a.slot==='K'&&(this.kActive||(this.shieldAbility&&this.shieldAbility!==a.id)))&&(!this.upgrades.includes(a.id)||this.rank(a.id)<3));
  const spells=SPELLS.filter(a=>a.id!=='ember'&&!this.upgrades.includes(a.id));
  overlay.innerHTML=`<div class="panel upgrade-panel"><div class="gold">LEVEL ${this.level} COMPLETE · ${this.rescued} SURVIVORS SAFE</div><h2>Build your Champion.</h2>${this.levelUpSummary()}<p>Choose one upgrade. All choices are permanent this run. K accepts a shield ability or a fourth active ability. New active abilities fill U, I, O, then K. Protector is passive.</p><h3>CHAMPION ABILITIES</h3><div class="upgrade-grid">${champions.map(a=>{const owned=this.upgrades.includes(a.id),full=!owned&&a.slot==='ACTIVE'&&!this.hasActiveSlot();return `<button class="choice" data-up="${a.id}" ${full?'disabled':''}><b>${owned?'Upgrade ':''}${a.name}</b><small>${owned?`${this.abilityKey(a.id)} · RANK ${this.rank(a.id)+1}`:full?'ACTIVE SLOTS FULL':a.slot==='ACTIVE'?`KEY ${this.nextActiveKey()}`:a.slot}</small><span>${owned?this.rankDescription(a.id):a.description}</span></button>`}).join('')||'<p>All available Champion abilities are at maximum rank.</p>'}</div><h3>SPELLS</h3><div class="upgrade-grid">${spells.map(a=>`<button class="choice" data-up="${a.id}"><b>${a.name}</b><small>KEY ${a.label} · ${a.cost} CHAOS</small><span>${this.spellDescription(a.id)}</span></button>`).join('')||'<p>All spells unlocked.</p>'}</div></div>`;
  overlay.querySelectorAll<HTMLButtonElement>('[data-up]').forEach(b=>b.onclick=()=>this.unlockUpgrade(b.dataset.up!));
 }
 spellDescription(id:SpellId){return {ember:'Ranged fire attack.',ice:'A piercing lance with a cold explosion.',ward:'A six-second radiant ward halves attack damage.',volley:'Four radiant projectiles strike enemies ahead.',stone:'A forward cone of stone shards.',vines:'Raise a destructible barrier ahead.'}[id]}
 unlockUpgrade(id:string){
  if(this.phase!=='upgrade')return;
  const champion=CHAMPION_ABILITIES.find(a=>a.id===id),spell=SPELLS.find(a=>a.id===id);if(!champion&&!spell)return;
  const owned=this.upgrades.includes(id);
  if(champion){
   if(champion.slot==='K'&&(this.kActive||(this.shieldAbility&&this.shieldAbility!==id)))return;
   if(owned&&this.rank(champion.id)>=3)return;
   if(!owned&&isActiveAbility(id)&&!this.hasActiveSlot())return;
   this.abilityRanks[champion.id]=owned?this.rank(champion.id)+1:1;
  }else if(owned)return;
  if(!owned){this.upgrades.push(id);if(id==='bash'||id==='throw')this.shieldAbility=id;if(isActiveAbility(id)){const index=this.abilitySlots.indexOf(null);if(index>=0)this.abilitySlots[index]=id;else this.kActive=id}}
  this.showUpgradeSummary(id,owned);
 }
 showUpgradeSummary(id:string,upgraded:boolean){
  this.phase='summary';const champion=CHAMPION_ABILITIES.find(a=>a.id===id),spell=SPELLS.find(a=>a.id===id);const name=champion?.name??spell?.name??'';
  overlay.innerHTML=`<div class="panel"><div class="gold">${name.toUpperCase()} ${upgraded?'UPGRADED':'UNLOCKED'}</div><h2>${champion?`${this.abilityKey(champion.id)} · Rank ${this.rank(champion.id)}`:`Key ${spell!.label}`}</h2><p>${upgraded?this.rankDescription(champion!.id):champion?.description??this.spellDescription(spell!.id)}</p>${this.levelUpSummary()}<div class="build-summary">${['K',...ABILITY_SLOTS].map(key=>{const ability=key==='K'?(this.shieldAbility??this.kActive):this.abilitySlots[ABILITY_SLOTS.indexOf(key as typeof ABILITY_SLOTS[number])];return `<span><b>${key}</b> ${CHAMPION_ABILITIES.find(a=>a.id===ability)?.name??'Empty'}</span>`}).join('')}</div><p>Abilities stay on their assigned key for this run. Further upgrades strengthen the same ability.</p><button class="primary" id="next-wave">START LEVEL ${this.level+1} →</button></div>`;
  document.querySelector('#next-wave')!.addEventListener('click',()=>{this.applyLevel(this.level+1);this.hp=Math.min(this.maxHp,this.hp+22);this.wave=1;this.startWave()});
 }
 createHotbar(){
  this.hotbar=document.createElement('div');this.hotbar.className='spellbar';
  for(const spell of SPELLS){const b=document.createElement('button');b.dataset.spell=spell.id;b.innerHTML=`<kbd>${spell.label}</kbd><span>${spell.name}</span><small></small>`;bindTouchAction(b,()=>{if(this.phase==='play'&&!this.paused)this.cast(spell.id)});this.hotbar.append(b)}
  document.querySelector('.game-shell')!.after(this.hotbar);
  this.championbar=document.createElement('div');this.championbar.className='championbar';
  for(const key of ['K',...ABILITY_SLOTS]){const b=document.createElement('button');b.dataset.abilityKey=key;b.innerHTML=`<kbd>${key}</kbd><span></span><small></small>`;bindTouchAction(b,()=>{if(this.phase==='play'&&!this.paused)this.activateAbilityKey(key)});this.championbar.append(b)}
  const passive=document.createElement('div');passive.className='passive-status';passive.innerHTML='<span>Protector</span><small>PASSIVE · LOCKED</small>';this.championbar.append(passive);this.hotbar.after(this.championbar);
 }
 unlocked(id:SpellId){return id==='ember'||this.upgrades.includes(id)}
 notify(text:string){this.message=text;this.messageTime=1.8}
 pressed(key:string){return this.pendingPress.has(key)||(this.down(key)&&!this.previousKeys.has(key))}
 cast(id:SpellId){
  const spell=SPELLS.find(s=>s.id===id)!;
  if(this.focusTime>0){this.notify('Battle Focus prevents spellcasting.');return}
  if(!this.unlocked(id)){this.notify(`${spell.name} unlocks between levels.`);return}
  if((this.spellCooldowns[id]??0)>0){this.notify(`${spell.name} is recharging.`);return}
  if(this.blocking){this.notify('Lower your shield to cast.');return}
  if(this.energy<spell.cost){this.notify('Not enough Chaos Energy.');return}
  const targets=this.enemies.filter(e=>e.hp>0&&(e.x-this.x)*this.face>=-12).sort((a,b)=>Math.abs(a.x-this.x)-Math.abs(b.x-this.x));
  if(id==='volley'&&!targets.length){this.notify('No enemies ahead for Hunter’s Volley.');return}
  this.energy-=spell.cost;this.spellCooldowns[id]=spell.cooldown;if(id!=='ember')this.burst(this.x+this.face*30,this.y-48,spell.color);tone(id==='ward'?350:520,.15);
  if(id==='ember'){this.swing=0;this.heroAnimator.startEmber(this.face);this.pendingEmber={delay:.12,face:this.face,damage:this.spellDamage};}
  if(id==='ice')this.shots.push({x:this.x+this.face*30,y:this.y-48,dir:this.face,life:.8,spell:id,damage:48});
  if(id==='ward')this.wardTime=6;
  if(id==='volley')for(let i=0;i<4;i++){const e=targets[i%Math.min(4,targets.length)];this.burst(e.x,G-45,spell.color,10);this.hurt(e,19)}
  if(id==='stone'){for(const e of targets){const dx=(e.x-this.x)*this.face;if(dx<190&&Math.abs(G-44-(this.y-48))<35+dx*.4)this.hurt(e,38)}for(let i=0;i<30;i++)this.particles.push({x:this.x+this.face*20,y:this.y-35,vx:this.face*Phaser.Math.Between(180,430),vy:Phaser.Math.Between(-140,30),life:.45,color:spell.color})}
  if(id==='vines')this.wall={x:Phaser.Math.Clamp(this.x+this.face*130,380,1160),hp:110,max:110};
 }
 bash(){
  if(this.shieldAbility!=='bash'){this.notify('Shield Bash unlocks between levels.');return}
  if(this.stamina<25){this.notify('Not enough stamina for Shield Bash.');return}
  this.stamina-=25;this.bashTime=.3;tone(190);
  for(const e of this.enemies){if(e.hp>0&&(e.x-this.x)*this.face>-8&&(e.x-this.x)*this.face<100&&Math.abs(this.y-G)<70){e.x+=this.face*(80+20*(this.rank('bash')-1));e.stunned=1.2+.3*(this.rank('bash')-1);this.burst(e.x,G-40,0xe9d794)}}
 }
 activateAbilityKey(key:string){
  const id=key==='K'?(this.shieldAbility??this.kActive):this.abilitySlots[ABILITY_SLOTS.indexOf(key as typeof ABILITY_SLOTS[number])];
  if(!id){this.notify(`Unlock an ability for ${key} between levels.`);return}
  if(id==='bash'){this.bash();return}
  const ability=CHAMPION_ABILITIES.find(a=>a.id===id)!;
  if(ability.cooldown>0&&(this.abilityCooldowns[id]??0)>0){this.notify(`${ability.name} is recharging.`);return}
  if(this.stamina<ability.cost){this.notify('Not enough stamina.');return}
  if(id==='throw'&&this.shieldFlight)return;
  this.stamina-=ability.cost;if(ability.cooldown>0)this.abilityCooldowns[id]=this.abilityCooldown(id);
  if(id==='throw'){this.shieldFlight={x:this.x+this.face*25,y:this.y-45,dir:this.face,originX:this.x,returning:false,hits:new Set()};this.blocking=false}
  if(id==='rally'){const center=Phaser.Math.Clamp(this.x+this.face*230,420,1110);this.arrows=Array.from({length:9+3*(this.rank('rally')-1)},(_,i)=>({targetX:center-140+i*280/(8+3*(this.rank('rally')-1)),delay:i*.08,progress:0}));this.notify('Rallying Cry! Archers, loose!')}
  if(id==='focus'){this.focusTime=8+2*(this.rank('focus')-1);this.wardTime=0;this.notify('Battle Focus: invulnerable. Spells unavailable.')}
  if(id==='cripple'){this.crippleTime=8;this.notify('Crippling Strike primed for your next sword hit.')}
  if(id==='reach'){this.reachTime=8+3*(this.rank('reach')-1);this.notify('Strike Through: double sword reach.')}
  tone(id==='rally'?420:250,.16);
 }
 takeDamage(damage:number,enemyAttack=false){if(this.focusTime>0)return;this.hp-=enemyAttack?Math.max(0,damage-this.progression.armourBonus)*(this.wardTime>0?.5:1):damage}
 tickChampion(dt:number){
  for(const id of Object.keys(this.abilityCooldowns) as ChampionId[])this.abilityCooldowns[id]=Math.max(0,(this.abilityCooldowns[id]??0)-dt);
  this.focusTime=Math.max(0,this.focusTime-dt);this.reachTime=Math.max(0,this.reachTime-dt);this.crippleTime=Math.max(0,this.crippleTime-dt);this.protectorCd=Math.max(0,this.protectorCd-dt);
  const shield=this.shieldFlight;
  if(shield){
   if(!shield.returning){shield.x+=shield.dir*500*dt;if(Math.abs(shield.x-shield.originX)>=320+60*(this.rank('throw')-1)||shield.x<320||shield.x>1250)shield.returning=true}
   else{const dx=this.x-shield.x,dy=this.y-45-shield.y,distance=Math.hypot(dx,dy);if(distance<600*dt+12)this.shieldFlight=null;else{shield.x+=dx/distance*600*dt;shield.y+=dy/distance*600*dt}}
   for(const e of this.enemies)if(e.hp>0&&!shield.hits.has(e)&&Math.hypot(e.x-shield.x,G-44-shield.y)<35){shield.hits.add(e);this.hurt(e,35+10*(this.rank('throw')-1)+this.progression.shieldDamageBonus,shield.dir);this.burst(e.x,G-44,0xd5bd7d)}
  }
  for(const arrow of this.arrows){arrow.delay-=dt;if(arrow.delay>0)continue;arrow.progress+=dt*1.5;if(arrow.progress>=1){for(const e of this.enemies)if(e.hp>0&&Math.abs(e.x-arrow.targetX)<40)this.hurt(e,20+5*(this.rank('rally')-1),1);this.burst(arrow.targetX,G-20,0xc5ab70,4)}}
  this.arrows=this.arrows.filter(a=>a.progress<1);
 }
 explodeIce(shot:Shot){this.burst(shot.x,shot.y,0x8cd7e5,30);for(const e of this.enemies)if(e.hp>0&&Math.hypot(e.x-shot.x,G-44-shot.y)<105)this.hurt(e,34,shot.dir)}
 updateHotbar(){
  this.touchControls?.update(this.phase,this.paused);
  for(const b of Array.from(this.hotbar.querySelectorAll<HTMLButtonElement>('button'))){
   const id=b.dataset.spell as SpellId;const spell=SPELLS.find(s=>s.id===id)!;const unlocked=this.unlocked(id);const cd=this.spellCooldowns[id]??0;
   const status=!unlocked?'LOCKED':this.focusTime>0?'FOCUS: BLOCKED':id==='ward'&&this.wardTime>0?`ACTIVE ${Math.ceil(this.wardTime)}s`:cd>0?`${cd.toFixed(1)}s`:`${spell.cost} CHAOS`;
   if(b.dataset.status===status)continue;b.dataset.status=status;b.classList.toggle('locked',!unlocked);b.classList.toggle('recharging',cd>0);b.classList.toggle('active',id==='ward'&&this.wardTime>0);b.querySelector('small')!.textContent=status;b.setAttribute('aria-label',`${spell.name}, key ${spell.label}, ${status}`);
  }
  for(const b of Array.from(this.championbar.querySelectorAll<HTMLButtonElement>('button'))){
   const key=b.dataset.abilityKey!;const id=key==='K'?(this.shieldAbility??this.kActive):this.abilitySlots[ABILITY_SLOTS.indexOf(key as typeof ABILITY_SLOTS[number])];const ability=CHAMPION_ABILITIES.find(a=>a.id===id);
   const cd=id?this.abilityCooldowns[id]??0:0;
   const active=id==='focus'?this.focusTime:id==='reach'?this.reachTime:id==='cripple'?this.crippleTime:0;
   const status=!id?'EMPTY':id==='throw'&&this.shieldFlight?'RETURNING':active>0?`ACTIVE ${Math.ceil(active)}s`:cd>0?`${cd.toFixed(1)}s`:id==='rally'?`READY · ${this.abilityCooldown(id)}s`:`${ability!.cost} STAMINA`;
   const name=ability?`${ability.name} · ${this.rank(ability.id)}`:(key==='K'?'Shield ability':'Champion ability');const stamp=name+status;if(b.dataset.status===stamp)continue;b.dataset.status=stamp;b.querySelector('span')!.textContent=name;b.querySelector('small')!.textContent=status;b.classList.toggle('locked',!id);b.classList.toggle('active',active>0);b.setAttribute('aria-label',`${name}, key ${key}, ${status}`);
  }
  this.championbar.querySelector('.passive-status small')!.textContent=this.upgrades.includes('protector')?`PASSIVE · RANK ${this.rank('protector')}`:'PASSIVE · LOCKED';
 }
 completeWave(){
  if(this.wave<WAVES_PER_LEVEL){
   this.phase='wavebreak';
   overlay.innerHTML=`<div class="panel"><div class="gold">${chapterForLevel(this.level).location.toUpperCase()} · WAVE ${this.wave} CLEARED</div><h2>The refugees move on.</h2><p>Elowen · Level ${this.level} ${this.progression.tier}<br>${chapterForLevel(this.level).story}</p><button class="primary" id="continue-wave">START WAVE ${this.wave+1} →</button></div>`;
   document.querySelector('#continue-wave')!.addEventListener('click',()=>{this.wave++;this.startWave()});
  }else if(this.level<MAX_LEVEL)this.upgrade();
  else this.beginEnding();
 }
 beginEnding(){
  this.phase='ending';this.endingTime=0;overlay.innerHTML='';this.x=450;this.y=G;this.face=1;this.inv=0;this.blocking=this.crouching=false;
  this.wall=null;this.shots=[];this.pendingEmber=null;this.shieldFlight=null;this.arrows=[];this.focusTime=this.reachTime=this.crippleTime=this.wardTime=0;this.touch.clear();
 }
 tickEnding(dt:number){
  this.endingTime+=dt;
  if(this.endingTime>=1.3&&!this.bridgeDestroyed){this.bridgeDestroyed=true;this.cameras.main.shake(500,.012);this.burst(450,G-35,0xf5a34b,85);this.burst(480,G+20,0xd7cba6,70);tone(80,.5)}
  if(this.bridgeDestroyed)this.y=G+Math.min(210,(this.endingTime-1.3)*150);
  if(this.endingTime>=2.4){this.heroSacrificed=true;this.hp=0}
  for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt}this.particles=this.particles.filter(p=>p.life>0);
  if(this.endingTime>=4.5)this.end(true);
 }
 drawEnding(g:Phaser.GameObjects.Graphics){
  if(!this.bridgeDestroyed)return;
  // Cover the destroyed span with the river; stone fragments fall below it.
  if(!this.scenery.getData('ambient')?.shader){g.fillStyle(0x182e36);g.fillRect(325,G-13,315,220);
  for(let i=0;i<16;i++){g.fillStyle(i%2?0x315561:0x294650);g.fillRect(325,G+20+i*12,315,4)}}
  for(let i=0;i<18;i++){const fall=Math.min(160,(this.endingTime-1.3)*125+i*3);g.fillStyle(i%2?0x6f7163:0x494e47);g.fillRect(345+i*15,G+fall+(i%3)*14,12,10)}
  if(this.phase==='ending'&&this.endingTime<2.7){g.fillStyle(0xf1a050,Math.max(0,1-(this.endingTime-1.3)/1.4));g.fillCircle(450,G+10,50+(this.endingTime-1.3)*90)}
 }
 end(win:boolean){this.pendingEmber=null;this.heroAnimator.reset();this.phase=win?'win':'dead';overlay.innerHTML=`<div class="panel"><div class="gold">${win?'THE CROSSING IS DESTROYED · THE REFUGEES ARE SAFE':'GREYFALL REMEMBERS'}</div><h2>${win?'Her last stand. Their tomorrow.':'The last light fades.'}</h2><p>${this.rescued} survivors escaped · ${this.kills} undead defeated${this.lost?` · ${this.lost} survivors lost`:''}<br>${win?'Elowen sacrifices herself to destroy the crossing.<br>The bridge falls, cutting off the dead. Beyond the river, the refugees carry her name into tomorrow.':'Rise again. They still need you.'}</p><button class="primary" id="retry">${win?'STAND AGAIN':'TRY AGAIN'} →</button></div>`;document.querySelector('#retry')!.addEventListener('click',()=>this.begin())}
 update(_time:number,delta:number){const dt=Math.min(delta/1000,.04);if(this.pressed('ESC')&&this.phase==='play'){this.paused=!this.paused;overlay.innerHTML=this.paused?'<div class="panel"><div class="gold">A MOMENT OF STILLNESS</div><h2>Paused</h2><p>Press Escape to return to the crossing.</p><button class="primary" id="resume">RESUME</button></div>':'';document.querySelector('#resume')?.addEventListener('click',()=>{this.paused=false;overlay.innerHTML=''})}this.touchControls?.update(this.phase,this.paused);if(this.phase==='play'&&!this.paused)this.tick(dt);if(this.phase==='ending')this.tickEnding(dt);this.tickHeroAnimation(dt);if(!this.paused){this.ambientTime+=dt;updateEnvironment(this.scenery,dt,this.bridgeDestroyed)}this.draw();this.updateHotbar();this.previousKeys=new Set(Object.keys(this.keys).filter(k=>this.down(k)));this.pendingPress.clear();}
 tickEmber(dt:number){
  const cast=this.pendingEmber;if(!cast)return;
  cast.delay-=dt;if(cast.delay>1e-6)return;
  const tip=this.heroAnimator.emberTip(this.x,this.y,cast.face,this.crouching);
  this.shots.push({...tip,dir:cast.face,life:2,spell:'ember',damage:cast.damage});
  this.burst(tip.x,tip.y,0xffa13d,8);this.pendingEmber=null;
 }
 tick(dt:number){this.tickChampion(dt);for(const id of Object.keys(this.spellCooldowns) as SpellId[])this.spellCooldowns[id]=Math.max(0,(this.spellCooldowns[id]??0)-dt);this.wardTime=Math.max(0,this.wardTime-dt);this.bashTime=Math.max(0,this.bashTime-dt);this.messageTime=Math.max(0,this.messageTime-dt);this.clock+=dt;this.timer-=dt;this.attackCd-=dt;this.inv-=dt;this.swing=Math.max(0,this.swing-dt);this.blocking=this.down('L')&&this.stamina>5&&!this.shieldFlight;this.crouching=this.down('S')&&this.y>=G;const move=(this.down('D')?1:0)-(this.down('A')?1:0);if(move){this.face=move;this.x=Phaser.Math.Clamp(this.x+move*dt*(this.blocking||this.crouching?90:215),355,1000)}if(this.down('W')&&this.y>=G&&!this.crouching){this.vy=-450;this.y-=1;this.heroAnimator.startJump();tone(260)}this.vy+=1100*dt;this.y+=this.vy*dt;if(this.y>=G){this.y=G;this.vy=0}this.stamina=Math.min(100,this.stamina+dt*(this.blocking?4:24));this.energy=Math.min(100,this.energy+dt*7);
 this.tickEmber(dt);
 for(const key of ['K',...ABILITY_SLOTS])if(this.pressed(key))this.activateAbilityKey(key);
 if(this.down('J')&&this.attackCd<=0&&!this.blocking&&!this.heroAnimator.casting){
  this.attackCd=SWORD_INTERVAL;this.swing=.22;tone(180);let landed=false;const range=SWORD_RANGE*(this.reachTime>0?2:1);this.heroAnimator.startAttack(range,this.face,this.reachTime>0,this.crouching);
  for(const e of this.enemies)if(e.hp>0&&(e.x-this.x)*this.face>-20&&(e.x-this.x)*this.face<range&&Math.abs(this.y-G)<100){
   const damage=this.damage*(this.focusTime>0?1.75+.25*(this.rank('focus')-1):1)*(this.crippleTime>0?1.5+.25*(this.rank('cripple')-1):1);this.hurt(e,damage);landed=true;if(this.crippleTime>0){e.rooted=3+this.rank('cripple')-1;this.burst(e.x,G-25,0x829dca)}
  }
  if(landed)this.crippleTime=0;
 }
 for(const spell of SPELLS)if(this.pressed(spell.key))this.cast(spell.id);
 if(this.timer<=0&&this.spawned<this.total){const kind=this.level>=3&&this.spawned%4===0?2:this.level>1&&this.spawned%3===0?1:0;const max=kind===2?145:kind===1?60:76;this.enemies.push({x:1260,hp:max,max,next:0,speed:kind===1?88:kind===2?32:45+this.level*5,kind});this.spawned++;this.timer=Math.max(.8,2.2-this.level*.25-(this.wave-1)*.1)}
 for(const survivor of this.survivors){
  survivor.t+=dt;survivor.x-=dt*75;if(survivor.x<75){this.rescued++;survivor.x=-1000;continue}
  const enemy=this.enemies.find(e=>e.hp>0&&Math.abs(e.x-survivor.x)<25);
  if(enemy){if(this.upgrades.includes('protector')&&!this.shieldFlight&&Math.abs(survivor.x-this.x)<120+30*(this.rank('protector')-1)&&this.protectorCd<=0){enemy.x+=(enemy.x>=survivor.x?1:-1)*65;enemy.stunned=.8;this.protectorCd=.8/this.rank('protector');this.burst(survivor.x,G-40,0xe7d297)}else{this.lost++;this.burst(survivor.x,G-40,0xe49276);survivor.x=-1000}}
 }
 this.survivors=this.survivors.filter(s=>s.x>-500);
 for(const e of this.enemies){e.next-=dt;e.rooted=Math.max(0,(e.rooted??0)-dt);e.stunned=Math.max(0,(e.stunned??0)-dt);if(e.hp<=0||e.stunned>0)continue;
  const wall=this.wall;if(wall&&Math.abs(e.x-wall.x)<43){if(e.next<=0){wall.hp-=e.kind===2?24:12;e.next=1;this.burst(wall.x,G-40,0x92b56d,5);if(wall.hp<=0)this.wall=null}continue}
 const near=Math.abs(e.x-this.x)<48&&Math.abs(this.y-G)<72;if(!near&&!(e.rooted&&e.rooted>0))e.x-=e.speed*dt;if(near&&e.next<=0){e.next=1.05;if(this.blocking&&(e.x-this.x)*this.face>=-8&&this.stamina>=this.shieldCost){this.stamina-=this.shieldCost;this.heroAnimator.blockedHit();e.x+=this.face*28;this.burst(this.x+this.face*25,this.y-40,0xe9d794);tone(360)}else if(this.inv<=0){this.takeDamage(e.kind===2?20:11,true);this.inv=.55;this.burst(this.x,this.y-40,0xd85d4d);tone(85,.14)}}if(e.x<300){this.takeDamage(20);e.hp=0;this.burst(e.x,G-40,0xd85d4d)}}
 for(const shot of this.shots){const speed=shot.spell==='ice'?600:510;shot.x+=shot.dir*speed*dt;shot.life-=dt;const color=shot.spell==='ice'?0x8cd7e5:0xf3a25d;this.particles.push({x:shot.x,y:shot.y,vx:-shot.dir*30,vy:-15,life:.2,color});const e=this.enemies.find(e=>e.hp>0&&Math.abs(e.x-shot.x)<25&&Math.abs(G-44-shot.y)<56);if(e){this.hurt(e,shot.damage,shot.dir);shot.life=0}if(shot.spell==='ice'&&shot.life<=0)this.explodeIce(shot)}
 this.shots=this.shots.filter(s=>s.life>0);this.enemies=this.enemies.filter(e=>e.hp>0);for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt}this.particles=this.particles.filter(p=>p.life>0);if(this.hp<=0)this.end(false);else if(this.spawned>=this.total&&!this.enemies.length&&!this.survivors.length){this.completeWave()}}
 drawVillager(s:Survivor){let im=this.spritePool[this.spriteIndex++];if(!im){im=this.add.image(0,0,'characters').setDepth(1);this.spritePool.push(im)}this.villagerAnimator.render(im,s.villager,s.x,G,s.t);this.art.fillStyle(0x061516,.35);this.art.fillEllipse(s.x,G+2,s.villager?.startsWith('rottan-mouse-')?20:40,s.villager?.startsWith('rottan-mouse-')?4:8)}
 sprite(x:number,y:number,zombie=false,kind=0,t=0,face=1,crouch=false,survivor=false){const g=this.art;if(!survivor&&this.textures.exists('characters')){let im=this.spritePool[this.spriteIndex++];if(!im){im=this.add.image(0,0,'characters').setDepth(1);this.spritePool.push(im)}if(!zombie&&this.heroAnimator.render(im,x,y,face,this.vy,crouch)){const lift=Phaser.Math.Clamp((G-y)/120,0,1);g.fillStyle(0x061516,.35-lift*.18);g.fillEllipse(x,G+2,54-lift*20,10-lift*3);return}im.setData('heroAction',zombie?'enemy':'idle');const animatedHero=!zombie&&this.idleDurations.length>0;const customHero=animatedHero||(!zombie&&this.textures.exists('elowen')&&this.textures.get('elowen').has('hero'));const frame=animatedHero?'idle'+this.idleFrame:customHero?'hero':'figure'+(zombie?kind+1:0);im.setTexture(animatedHero?'elowen-idle':customHero?'elowen':'characters',frame).setOrigin(.5,1).setPosition(x,y).setFlipX(face<0).setVisible(true);const h=(customHero?96:kind===2?124:104)*(crouch?.65:1);const ratio=im.frame.width/im.frame.height;im.setDisplaySize(h*ratio,h);im.setAngle(Math.sin(t*10)*(zombie?2:1));g.fillStyle(0x061516,.35);g.fillEllipse(x,y+2,54,10);return}const scale=kind===2?1.35:1;const unit=2.6*scale;const top=y-(crouch?49:78)*scale;const rect=(a:number,b:number,w:number,h:number,c:number)=>{g.fillStyle(c);g.fillRect(Math.round(x+a*unit*face-(face<0?w*unit:0)),Math.round(top+b*unit*(crouch?.63:1)),w*unit,h*unit*(crouch?.63:1))};g.fillStyle(0x061516,.35);g.fillEllipse(x,y+2,52*scale,10);const skin=zombie?0x829978:0xd6ac83;const dark=zombie?0x38473d:0x253445;const cloth=survivor?0x9b8566:zombie?kind===1?0x716451:0x59625a:0x4b7777;const stride=Math.sin(t*10)*2;rect(-5,22,4,7,dark);rect(2,22,4,7,dark);rect(-6+stride,28,6,2,0x342e2a);rect(2-stride,28,6,2,0x342e2a);if(!zombie&&!survivor){rect(-8,10,6,15,0x913f3b);rect(-9,16,3,10,0x6d3033)}rect(-5,10,11,12,cloth);rect(-4,12,9,2,0x82908b);rect(-5,20,11,2,0x9b8458);rect(-3,8,6,3,skin);rect(-4,2,9,7,skin);rect(-5,1,10,3,zombie?0x3d4437:0x57402f);rect(-5,3,3,9,zombie?0x48543f:0x6b4932);rect(2,5,2,1,zombie?0xe4c477:0x142b2d);rect(5,6,1,2,skin);rect(-8,11,3,9,cloth);rect(-8,19,3,3,skin);rect(6,11,3,zombie?5:8,cloth);rect(7,zombie?15:18,zombie?7:3,3,skin);if(zombie){rect(-1,14,3,4,0x424838);rect(3,19,2,3,0x8c5c4e)}else if(!survivor){rect(7,20,2,7,0x9b8553);rect(5,20,6,1,0xd8bd79);rect(8,10,2,10,0xd0dbcf);rect(8,9,1,1,0xf9f1c8);rect(-12,14,6,10,0xb49a64);rect(-11,15,4,8,0x4c6360);rect(-9,16,1,6,0xc2b37d)}}
 draw(){this.spriteIndex=0;this.spritePool.forEach(im=>im.setVisible(false));const g=this.art;g.clear();this.drawEnding(g);for(let i=0;i<20;i++){const x=(i*79+Math.sin(this.ambientTime/2.5+i)*20)%W;g.fillStyle(0xc6b878,.35);g.fillRect(x,180+(i*37)%290,2,2)}for(const s of this.survivors)this.drawVillager(s);for(const e of this.enemies){this.sprite(e.x,G,true,e.kind,this.clock,-1);g.fillStyle(0x15211e);g.fillRect(e.x-21,G-(e.kind===2?115:88),42,3);g.fillStyle(0x9c7754);g.fillRect(e.x-21,G-(e.kind===2?115:88),42*e.hp/e.max,3)}if(!this.heroSacrificed&&(this.inv<=0||Math.floor(this.inv*20)%2===0))this.sprite(this.x,this.y,false,0,this.phase==='play'&&(this.down('A')||this.down('D'))?this.clock:0,this.face,this.crouching);this.heroAnimator.renderBeam(this.x,this.y,this.crouching);if(this.wall){g.fillStyle(0x173c2c,.9);g.fillRect(this.wall.x-15,G-110,30,110);for(let i=0;i<5;i++){g.lineStyle(4,0x80a566);g.beginPath();g.moveTo(this.wall.x-16+i*7,G);g.lineTo(this.wall.x+Math.sin(i)*16,G-65);g.lineTo(this.wall.x-14+i*7,G-110);g.strokePath()}g.fillStyle(0x9cb86a);g.fillRect(this.wall.x-25,G-122,50*this.wall.hp/this.wall.max,4)}
 if(this.focusTime>0){g.lineStyle(4,0xefba55,.85);g.strokeEllipse(this.x,this.y-50,100,125)}
 if(this.shieldFlight){const shield=this.shieldFlight;g.fillStyle(0x23375e);g.lineStyle(2,0xd8bb7e);g.beginPath();g.moveTo(shield.x,shield.y-18);g.lineTo(shield.x+14,shield.y-10);g.lineTo(shield.x+10,shield.y+8);g.lineTo(shield.x,shield.y+22);g.lineTo(shield.x-10,shield.y+8);g.lineTo(shield.x-14,shield.y-10);g.closePath();g.fillPath();g.strokePath();g.lineStyle(1,0xd8bb7e);g.lineBetween(shield.x,shield.y-10,shield.x,shield.y+14);g.lineBetween(shield.x-7,shield.y-4,shield.x,shield.y+3);g.lineBetween(shield.x+7,shield.y-4,shield.x,shield.y+3);g.fillStyle(0x77c7ed);g.fillRect(shield.x-2,shield.y+1,4,5)}
 for(const arrow of this.arrows){if(arrow.delay>0)continue;const t=arrow.progress;const x=130+(arrow.targetX-130)*t,y=G-230+210*t-Math.sin(t*Math.PI)*100;g.lineStyle(2,0xc3ae81);g.lineBetween(x-9,y-5,x+7,y+4);g.fillStyle(0xd8d4bd);g.fillTriangle(x+7,y+4,x+1,y-3,x+1,y+7)}
 this.warriorShield.render(this.x,this.y,this.wardTime,this.phase==='play');
 if(this.bashTime>0){g.lineStyle(6,0xd7c297,this.bashTime/.3);g.strokeCircle(this.x+this.face*55,this.y-40,30)}
 if(this.swing>0&&!this.heroAnimator.attack){g.lineStyle(7,0xe6ddbd,this.swing/.22);g.beginPath();g.arc(this.x,this.y-43,85*(this.reachTime>0?2:1),this.face>0?-1:2.1,this.face>0?1:4.2);g.strokePath();g.lineStyle(2,0xffffff,.7);g.beginPath();g.arc(this.x,this.y-43,92*(this.reachTime>0?2:1),this.face>0?-.8:2.3,this.face>0?.8:4);g.strokePath()}for(const s of this.shots){g.fillStyle(s.spell==='ice'?0x8cd7e5:0xe56c35,.2);g.fillCircle(s.x,s.y,20);if(s.spell==='ember'){g.fillStyle(0xff8b25);g.fillTriangle(s.x-s.dir*24,s.y,s.x+s.dir*10,s.y-7,s.x+s.dir*10,s.y+7);g.fillStyle(0xffffff);g.fillTriangle(s.x-s.dir*12,s.y,s.x+s.dir*8,s.y-3,s.x+s.dir*8,s.y+3)}else{g.fillStyle(0x8cd7e5);g.fillRect(s.x-10,s.y-7,18,14);g.fillStyle(0xffecc0);g.fillRect(s.x-3,s.y-4,8,8)}}for(const p of this.particles){g.fillStyle(p.color,Math.min(1,p.life*3));g.fillRect(p.x,p.y,3,3)}const h=this.hud;h.clear();h.fillStyle(0x0c1e22,.88);h.fillRoundedRect(20,18,350,89,4);const bar=(y:number,v:number,c:number,max=100)=>{h.fillStyle(0x30433f);h.fillRect(125,y,210,5);h.fillStyle(c);h.fillRect(125,y,210*Phaser.Math.Clamp(v/max,0,1),5)};bar(37,this.hp,0xb76051,this.maxHp);bar(59,this.stamina,0xb8a26c);bar(81,this.energy,0x649caa);this.labels.setText(`HEALTH\nSTAMINA\nCHAOS ENERGY`);h.fillStyle(0x0c1e22,.85);h.fillRoundedRect(940,18,320,89,4);const status=this.phase==='title'?'GREYFALL TOWN':`${chapterForLevel(this.level).location.toUpperCase()} · WAVE ${this.wave} / ${WAVES_PER_LEVEL}`;if(!this.data.get('statusText')){this.data.set('statusText',this.add.text(962,31,'',{fontFamily:'Arial',fontSize:'12px',color:'#dbc99d',lineSpacing:15}).setDepth(10));this.data.set('bottomText',this.add.text(W/2,676,'',{fontFamily:'Arial',fontSize:'12px',color:'#cdc8ac'}).setOrigin(.5).setDepth(10))}(this.data.get('statusText') as Phaser.GameObjects.Text).setText(`${status}\n${this.rescued} SAFE   ·   ${this.kills} UNDEAD DEFEATED\nELOWEN · LEVEL ${this.level} ${this.progression.tier.toUpperCase()}`);(this.data.get('bottomText') as Phaser.GameObjects.Text).setText(this.phase==='play'?this.messageTime>0?this.message:this.clock<6?chapterForLevel(this.level).story.toUpperCase():`${this.total-this.waveKills} ENEMIES THIS WAVE  ·  EMBER STRIKE ${(this.spellCooldowns.ember??0)>0?'RECHARGING':'READY'}`:this.phase==='ending'?'THE LAST REFUGEES ARE ACROSS. ELOWEN STAYS BEHIND.':'SWORD & SHIELD  /  EMBER STRIKE');}
}
try {new Phaser.Game({type:basicGraphics?Phaser.CANVAS:Phaser.AUTO,parent:'game',width:W,height:H,backgroundColor:'#162e2f',pixelArt:true,roundPixels:true,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Stand,audio:{noAudio:true}});
} catch(error) { startupFailed(error); }
