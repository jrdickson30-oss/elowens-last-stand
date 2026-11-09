import Phaser from 'phaser';
import { RISING_DURATION, type RisingAttack } from './rising-attack';
import { AIR_SPIN_DURATION, DIVE_WINDUP, type AerialAttack } from './aerial-attack';

export const SWORD_RANGE = 115;
export const SWORD_INTERVAL = .42;
type Action = 'slash' | 'thrust' | 'reach' | 'jump' | 'block' | 'walk' | 'guardWalk' | 'crouch' | 'crouchSlash' | 'crouchBlock' | 'crouchWalk' | 'ember' | 'ice' | 'radiant' | 'stone' | 'rising' | 'risingReach' | 'dive' | 'diveReach' | 'shieldThrow' | 'unshieldedWalk' | 'unshieldedSword' | 'unshieldedUtility';
type Metadata = {
  frameWidth: number; frameHeight: number; frameCount: number; columns: number;
  durationsMs: number[]; groundY?: number; anchor?: {x: number; groundY: number};
  rearFootAnchorX?: number;
  footAnchors?: number[];
  bodyHeight?: number;
  frameAnchors?: number[]; tip?: {x:number;y:number}; catchPoint?: {x:number;y:number}; releaseFrame?: number;
};
type Clip = {key: string; meta: Metadata; scale: number; anchor: number; feet: number[]};
type Bounds = {left: number; top: number; right: number; bottom: number};
const assets: Record<Action, {file: string; bodyHeight: number; revision?: string}> = {
  dive: {file: 'downward-slash', bodyHeight: 450},
  diveReach: {file: 'downward-strike-through', bodyHeight: 450},
  rising: {file: 'spiral-attack', bodyHeight: 360},
  risingReach: {file: 'spiral-strike-through', bodyHeight: 285},
  ember: {file: 'ember-strike', bodyHeight: 386},
  ice: {file: 'ice-lance', bodyHeight: 400, revision: 'shield-frost-1'},
  radiant: {file: 'radiant-volley', bodyHeight: 355},
  stone: {file: 'stoneshard-barrage', bodyHeight: 385},
  shieldThrow: {file:'shield-throw',bodyHeight:400,revision:'throw-1'},
  unshieldedWalk: {file:'unshielded-walk',bodyHeight:400,revision:'throw-1'},
  unshieldedSword: {file:'unshielded-sword',bodyHeight:400,revision:'throw-1'},
  unshieldedUtility: {file:'unshielded-utility',bodyHeight:400,revision:'throw-1'},
  slash: {file: 'sword-attack', bodyHeight: 191},
  thrust: {file: 'sword-thrust', bodyHeight: 174},
  reach: {file: 'strike-through', bodyHeight: 191},
  jump: {file: 'jump', bodyHeight: 188},
  block: {file: 'block', bodyHeight: 432},
  walk: {file: 'walk', bodyHeight: 424, revision: 'alternating-8-v2'},
  guardWalk: {file: 'guard-walk', bodyHeight: 438},
  crouch: {file: 'crouch', bodyHeight: 410},
  crouchSlash: {file: 'crouch-sword-attack', bodyHeight: 432},
  crouchBlock: {file: 'crouch-block', bodyHeight: 560},
  crouchWalk: {file: 'crouch-walk', bodyHeight: 580},
};

export function preloadHeroActions(scene: Phaser.Scene) {
  for(const [id,asset] of Object.entries(assets)) {
    const path=`elowen-${asset.file}/Elowen-${asset.file}`;
    // Version the sheet and its layout together so cached six-pose walk files
    // cannot be paired with the replacement eight-pose animation.
    const revision=asset.revision?`?v=${asset.revision}`:'';
    scene.load.json(`hero-${id}-meta`,new URL(path+'.json'+revision,document.baseURI).href);
    // The supplied Strike Through uses the same sword poses. Its separate
    // effect layers let us extend the energy without stretching the heroine.
    if(id!=='reach')scene.load.image(`hero-${id}`,new URL(path+'-spritesheet.png'+revision,document.baseURI).href);
  }
  for(const frame of [3,4])scene.load.image(`hero-energy-${frame}`,new URL(`elowen-strike-through/effects/0${frame}.png`,document.baseURI).href);
}

function pixels(texture: Phaser.Textures.Texture) {
  const source=texture.getSourceImage() as HTMLImageElement;
  const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(source,0,0);
  return {data:ctx.getImageData(0,0,source.width,source.height).data,width:source.width};
}
function bounds(data: Uint8ClampedArray, width: number, x: number, y: number, w: number, h: number, threshold=90): Bounds {
  let left=w,top=h,right=-1,bottom=-1;
  for(let py=0;py<h;py++)for(let px=0;px<w;px++)if(data[((y+py)*width+x+px)*4+3]>threshold) {
    left=Math.min(left,px);top=Math.min(top,py);right=Math.max(right,px);bottom=Math.max(bottom,py);
  }
  return {left,top,right:right+1,bottom:bottom+1};
}

export class HeroAnimator {
  clips: Partial<Record<Action,Clip>> = {};
  nextAttack: 'slash'|'thrust' = 'slash';
  attack: {kind: 'slash'|'thrust'|'reach'|'crouchSlash'; elapsed: number; range: number; face: number; extended: boolean; fresh?: boolean}|null = null;
  casting: {kind?:'ember'|'ice'|'radiant'|'stone';elapsed:number;face:number;fresh:boolean}|null=null;
  shieldAway=false;
  shieldAction:{kind:'throw'|'catch';elapsed:number;face:number;fresh:boolean}|null=null;
  rising: RisingAttack<unknown>|null=null;
  aerial:AerialAttack<unknown>|null=null;
  private shieldlessAirAttack:RisingAttack<unknown>|AerialAttack<unknown>|null=null;
  moving=false;
  walkElapsed=0;
  crouchProgress=0;
  crouching=false;
  blocking=false;
  blockElapsed=0;
  blockImpact: number|null=null;
  airborne=false;
  jumpElapsed=0;
  landingTime=0;
  beam: Phaser.GameObjects.Image;
  effects = new Map<number,Bounds>();
  constructor(readonly scene: Phaser.Scene) {
    for(const [id,asset] of Object.entries(assets)) {
      if(id==='reach')continue;
      const key=`hero-${id}`,meta=scene.cache.json.get(key+'-meta') as Metadata|undefined;
      if(!scene.textures.exists(key)||!meta)continue;
      const texture=scene.textures.get(key),source=pixels(texture),feet:number[]=[];
      for(let frame=0;frame<meta.frameCount;frame++) {
        const column=frame%meta.columns,row=Math.floor(frame/meta.columns);
        texture.add(`pose-${frame}`,0,column*meta.frameWidth,row*meta.frameHeight,meta.frameWidth,meta.frameHeight);
        // Jump poses include vertical displacement in the sheet. Anchor each
        // pose's feet to the physics position instead of applying it twice.
        feet.push(meta.footAnchors?.[frame]??(id==='jump'?bounds(source.data,source.width,column*meta.frameWidth,row*meta.frameHeight,meta.frameWidth,meta.frameHeight,0).bottom:meta.anchor?.groundY??meta.groundY??meta.frameHeight));
      }
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      const anchor=meta.anchor?.x??(meta.rearFootAnchorX!==undefined?meta.rearFootAnchorX+48:meta.frameWidth/2);
      // Body height excludes an overhead sword and padding. One constant
      // scale per clip preserves the proportions of every pose.
      this.clips[id as Action]={key,meta,scale:96/(meta.bodyHeight??asset.bodyHeight),anchor,feet};
    }
    const reachMeta=scene.cache.json.get('hero-reach-meta') as Metadata|undefined;
    if(this.clips.slash&&reachMeta)this.clips.reach={...this.clips.slash,meta:{...reachMeta,frameWidth:this.clips.slash.meta.frameWidth}};
    for(const frame of [3,4]) {
      const key=`hero-energy-${frame}`;
      if(!scene.textures.exists(key))continue;
      const texture=scene.textures.get(key),source=texture.getSourceImage() as HTMLImageElement;
      const read=pixels(texture),box=bounds(read.data,read.width,0,0,source.width,source.height,0);
      if(box.right<=box.left||box.bottom<=box.top)continue;
      texture.add('energy',0,box.left,box.top,box.right-box.left,box.bottom-box.top);
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);this.effects.set(frame,box);
    }
    this.beam=scene.add.image(0,0,'hero-energy-3').setDepth(1.5).setVisible(false);
  }
  reset() {
    this.crouching=false;
    this.crouchProgress=0;
    this.moving=false;this.walkElapsed=0;
    this.blocking=false;this.blockElapsed=0;this.blockImpact=null;
    this.shieldAway=false;this.shieldAction=null;this.shieldlessAirAttack=null;
    this.aerial=null;this.rising=null;this.casting=null;this.attack=null;this.nextAttack='slash';this.airborne=false;this.jumpElapsed=this.landingTime=0;this.beam.setVisible(false);
  }
  startAttack(range: number, face: number, extended: boolean, crouching=false) {
    this.shieldAction=null;
    const kind=crouching&&this.clips.crouchSlash?'crouchSlash':extended?'reach':this.nextAttack;
    if(!extended&&kind!=='crouchSlash')this.nextAttack=this.nextAttack==='slash'?'thrust':'slash';
    this.attack=this.clips[kind]?{kind,elapsed:0,range,face,extended,fresh:true}:null;
  }
  startRising(attack:RisingAttack<unknown>) {this.shieldlessAirAttack=this.shieldAway?attack:null;this.shieldAction=null;this.attack=null;this.rising=attack;}
  startAerial(attack:AerialAttack<unknown>){this.shieldlessAirAttack=this.shieldAway?attack:null;this.shieldAction=null;this.attack=null;this.rising=null;this.aerial=attack;}
  startEmber(face:number) {this.shieldAction=null;this.aerial=null;this.rising=null;this.attack=null;this.casting=this.clips.ember?{elapsed:0,face,fresh:true}:null;}
  startRadiant(face:number) {this.shieldAction=null;this.aerial=null;this.rising=null;this.attack=null;this.casting=this.clips.radiant?{kind:'radiant',elapsed:0,face,fresh:true}:null;}
  emberTip(x:number,y:number,face:number,crouching:boolean) {
    const c=this.clips.ember;
    if(!c?.meta.tip)return {x:x+face*30,y:y-48};
    const f=c.meta.releaseFrame??3,anchor=c.meta.frameAnchors?.[f]??c.anchor;
    return {x:x+face*(c.meta.tip.x-anchor)*c.scale,y:y+(c.meta.tip.y-c.feet[f])*c.scale*(crouching?.65:1)};
  }
  startStone(face:number) {this.shieldAction=null;this.aerial=null;this.rising=null;this.attack=null;this.casting=this.clips.stone?{kind:'stone',elapsed:0,face,fresh:true}:null;}
  startIce(face:number) {this.shieldAction=null;this.aerial=null;this.rising=null;this.attack=null;this.casting=this.clips.ice?{kind:'ice',elapsed:0,face,fresh:true}:null;}
  iceReleaseDelay(){const c=this.clips.ice;return c?c.meta.durationsMs.slice(0,c.meta.releaseFrame??3).reduce((sum,ms)=>sum+ms,0)/1000:.34;}
  iceMuzzle(x:number,y:number,face:number,crouching:boolean){
    const c=this.clips.ice;if(!c?.meta.tip)return {x:x+face*35,y:y-52};
    const frame=c.meta.releaseFrame??3,anchor=c.meta.frameAnchors?.[frame]??c.anchor;
    return {x:x+face*(c.meta.tip.x-anchor)*c.scale,y:y+(c.meta.tip.y-c.feet[frame])*c.scale*(crouching?.65:1)};
  }
  shieldReleaseDelay(){const c=this.clips.shieldThrow;return c?c.meta.durationsMs.slice(0,c.meta.releaseFrame??3).reduce((sum,ms)=>sum+ms,0)/1000:.24;}
  get throwBusy(){return this.shieldAction?.kind==='throw'&&this.shieldAction.elapsed<this.shieldReleaseDelay();}
  startShieldThrow(face:number){this.aerial=null;this.rising=null;this.attack=null;this.shieldAway=false;this.shieldAction={kind:'throw',elapsed:0,face,fresh:true};}
  releaseShield(){this.shieldAway=true;if(this.shieldAction?.kind==='throw')this.shieldAction.elapsed=Math.max(this.shieldAction.elapsed,this.shieldReleaseDelay());}
  catchShield(face:number){
    this.shieldAway=false;
    // An ongoing sword/spell action already puts the returned shield back on
    // her arm. Preserve that action; idle returns get the dedicated catch.
    this.shieldAction=this.attack||this.rising||this.aerial||this.casting?null:{kind:'catch',elapsed:0,face,fresh:true};
  }
  shieldHand(x:number,y:number,face:number,crouching:boolean,catching=false){
    const c=this.clips.shieldThrow,point=catching?c?.meta.catchPoint:c?.meta.tip;
    if(!c||!point)return {x:x+face*25,y:y-45};
    const frame=catching?6:c.meta.releaseFrame??3,anchor=c.meta.frameAnchors?.[frame]??c.anchor;
    return {x:x+face*(point.x-anchor)*c.scale,y:y+(point.y-c.feet[frame])*c.scale*(crouching?.65:1)};
  }
  startJump() {this.airborne=true;this.jumpElapsed=0;this.landingTime=0;}
  blockedHit() {if(this.clips.block||this.clips.crouchBlock)this.blockImpact=0;}
  tick(dt: number, y: number, ground: number, blocking: boolean, playing: boolean, moving=false, crouching=false) {
    if(!playing){this.reset();return}
    if(this.shieldAction){
      const action=this.shieldAction,durations=this.clips.shieldThrow?.meta.durationsMs;
      if(action.fresh)action.fresh=false;else action.elapsed+=dt;
      const total=durations?(action.kind==='catch'?durations.slice(6):durations.slice(0,6)).reduce((sum,ms)=>sum+ms,0)/1000:action.kind==='catch'?.24:.48;
      if(action.elapsed>=total)this.shieldAction=null;
    }
    if(this.casting){
      if(this.casting.fresh)this.casting.fresh=false;else this.casting.elapsed+=dt;
      const duration=this.casting.kind&&this.casting.kind!=='ember'?(this.clips[this.casting.kind]!.meta.durationsMs.reduce((sum,ms)=>sum+ms,0)/1000):.36;
      if(this.casting.elapsed>=duration)this.casting=null;
    }
    this.crouching=crouching&&y>=ground;
    this.crouchProgress=y<ground?0:Phaser.Math.Clamp(this.crouchProgress+(crouching?dt:-dt),0,.4);
    this.moving=moving&&y>=ground;
    this.walkElapsed=this.moving?this.walkElapsed+dt:0;
    if(blocking) {
      this.blockElapsed=this.blocking?this.blockElapsed+dt:0;
      if(this.blockImpact!==null) {
        this.blockImpact+=dt;
        if(this.blockImpact>=.18)this.blockImpact=null;
      }
    } else {this.blockElapsed=0;this.blockImpact=null;}
    this.blocking=blocking;
    if(this.attack) {
      if(this.attack.fresh)this.attack.fresh=false;
      else this.attack.elapsed+=dt;
      if(blocking||this.attack.elapsed>=SWORD_INTERVAL)this.attack=null;
    }
    if(y<ground) {
      if(!this.airborne)this.jumpElapsed=0;
      this.airborne=true;this.jumpElapsed+=dt;this.landingTime=0;
    } else {
      if(this.airborne)this.landingTime=(this.clips.jump?.meta.durationsMs[5]??180)/1000;
      else this.landingTime=Math.max(0,this.landingTime-dt);
      this.airborne=false;
    }
  }
  attackFrame() {
    if(!this.attack)return 0;
    const durations=this.clips[this.attack.kind]!.meta.durationsMs;
    const total=durations.reduce((sum,ms)=>sum+ms,0);
    let elapsed=this.attack.elapsed/SWORD_INTERVAL*total;
    for(let frame=0;frame<durations.length;frame++) {
      if(elapsed<durations[frame])return frame;
      elapsed-=durations[frame];
    }
    return durations.length-1;
  }
  pose(vy: number) {
    if(this.shieldAction&&this.clips.shieldThrow){
      const action=this.shieldAction,durations=this.clips.shieldThrow.meta.durationsMs;
      let elapsed=action.elapsed*1000,frame=action.kind==='catch'?6:0;
      const end=action.kind==='catch'?7:5;
      while(frame<end&&elapsed>=durations[frame]){elapsed-=durations[frame];frame++;}
      return {kind:'shieldThrow' as const,frame,face:action.face};
    }
    if(this.aerial) {
      const a=this.aerial;
      if(a.kind==='dive')return {kind:(a.extended?'diveReach':'dive') as 'dive'|'diveReach',
        frame:a.landingElapsed!==null?(a.landingElapsed<.12?4:5):a.elapsed<DIVE_WINDUP?0:Math.min(3,1+Math.floor((a.elapsed-DIVE_WINDUP)/.04)),face:a.face};
      const kind=a.extended?'risingReach':'rising',durations=this.clips[kind]!.meta.durationsMs;
      let elapsed=a.elapsed/AIR_SPIN_DURATION*durations.reduce((sum,ms)=>sum+ms,0),frame=0;
      while(frame<durations.length-1&&elapsed>=durations[frame]){elapsed-=durations[frame];frame++}
      return {kind:kind as 'rising'|'risingReach',frame,face:a.face};
    }
    if(this.rising) {
      const kind=this.rising.extended?'risingReach':'rising';
      if(this.clips[kind]) {
        const durations=this.clips[kind].meta.durationsMs;
        let elapsed=this.rising.elapsed/RISING_DURATION*durations.reduce((sum,ms)=>sum+ms,0),frame=0;
        while(frame<durations.length-1&&elapsed>=durations[frame]){elapsed-=durations[frame];frame++}
        return {kind:kind as 'rising'|'risingReach',frame,face:this.rising.face};
      }
    }
    if(this.casting&&this.clips[this.casting.kind??'ember']){
      let elapsed=this.casting.elapsed*1000,frame=0;
      const kind=this.casting.kind??'ember',durations=this.clips[kind]!.meta.durationsMs;
      while(frame<durations.length-1&&elapsed>=durations[frame]){elapsed-=durations[frame];frame++}
      return {kind,frame,face:this.casting.face};
    }
    if(this.blocking&&(this.clips.block||this.clips.crouchBlock)) {
      const kind=this.crouching&&this.clips.crouchBlock?'crouchBlock':'block';
      if(!this.clips[kind])return null;
      if(kind==='block'&&this.moving&&this.blockElapsed>=.18&&this.blockImpact===null&&this.clips.guardWalk)return {kind:'guardWalk' as const,frame:this.walkFrame('guardWalk'),face:null};
      const frame=this.blockImpact!==null?(this.blockImpact<.08?3:4):this.blockElapsed<.09?0:this.blockElapsed<.18?1:this.blockElapsed<.36?2:5;
      return {kind:kind as 'block'|'crouchBlock',frame,face:null};
    }
    if(this.attack)return {kind:this.attack.kind,frame:this.attackFrame(),face:this.attack.face};
    if(this.clips.jump&&(this.airborne||this.landingTime>0)) {
      const frame=!this.airborne?5:this.jumpElapsed<.06?0:vy<-250?1:vy<-80?2:vy<=80?3:4;
      return {kind:'jump' as const,frame,face:null};
    }
    if(this.crouching&&this.moving&&this.crouchProgress>=.4&&this.clips.crouchWalk)return {kind:'crouchWalk' as const,frame:this.walkFrame('crouchWalk'),face:null};
    if(this.crouchProgress>0&&this.clips.crouch)return {kind:'crouch' as const,frame:Math.min(5,Math.floor(this.crouchProgress/.08)),face:null};
    if(this.moving&&this.clips.walk)return {kind:'walk' as const,frame:this.walkFrame('walk'),face:null};
    return null;
  }
  walkFrame(kind: 'walk'|'guardWalk'|'crouchWalk') {
    const durations=this.clips[kind]!.meta.durationsMs;
    let elapsed=this.walkElapsed*1000%durations.reduce((sum,ms)=>sum+ms,0);
    for(let frame=0;frame<durations.length;frame++){if(elapsed<durations[frame])return frame;elapsed-=durations[frame]}
    return 0;
  }
  private withoutShield(pose:{kind:Action;frame:number;face:number|null}|null,vy:number):{kind:Action;frame:number;face:number|null;angle?:number}{
    const face=pose?.face??null;
    if(pose?.kind==='shieldThrow')return pose;
    if(this.attack){
      const phase=Math.min(3,Math.floor(this.attack.elapsed/SWORD_INTERVAL*4));
      if(this.attack.kind==='crouchSlash')return {kind:'unshieldedUtility',frame:phase<2?8:9,face};
      return {kind:'unshieldedSword',frame:(this.attack.kind==='thrust'?4:0)+phase,face};
    }
    if(this.rising||this.aerial){
      const action=this.rising??this.aerial!;
      if(this.aerial?.kind==='dive')return {kind:'unshieldedUtility',frame:this.aerial.landingElapsed===null?6:9,face,angle:this.aerial.landingElapsed===null?this.aerial.face*25:0};
      const duration=this.rising?RISING_DURATION:AIR_SPIN_DURATION;
      // Animate the sword swing; rotating a single jump bitmap makes her tumble.
      return {kind:'unshieldedSword',frame:Math.min(3,Math.floor(action.elapsed/duration*4)),face};
    }
    if(this.casting){
      if((this.casting.kind??'ember')==='ember')return {kind:'unshieldedSword',frame:4+Math.min(3,Math.floor(this.casting.elapsed/.09)),face};
      return {kind:'shieldThrow',frame:4,face};
    }
    if(this.airborne)return {kind:'unshieldedUtility',frame:vy<=80?6:7,face};
    if(this.crouching||this.crouchProgress>0)return {kind:'unshieldedUtility',frame:this.moving?2+Math.floor(this.walkElapsed/.16)%4:1,face};
    if(this.moving){
      const c=this.clips.unshieldedWalk!,durations=c.meta.durationsMs;
      let elapsed=this.walkElapsed*1000%durations.reduce((sum,ms)=>sum+ms,0),frame=0;
      while(frame<durations.length-1&&elapsed>=durations[frame]){elapsed-=durations[frame];frame++;}
      return {kind:'unshieldedWalk',frame,face};
    }
    return {kind:'unshieldedUtility',frame:0,face};
  }
  render(image: Phaser.GameObjects.Image, x: number, y: number, face: number, vy: number, crouch: boolean) {
    // A returning shield must not swap the atlas halfway through an airborne attack.
    const finishingShieldless=this.shieldlessAirAttack!==null&&(this.rising===this.shieldlessAirAttack||this.aerial===this.shieldlessAirAttack);
    const logical=this.pose(vy),pose=this.shieldAway||finishingShieldless?this.withoutShield(logical,vy):logical;if(!pose)return false;
    const clip=this.clips[pose.kind]!,dir=pose.face??face;
    const anchor=(clip.meta.frameAnchors?.[pose.frame]??clip.anchor)/clip.meta.frameWidth;
    image.setTexture(clip.key,`pose-${pose.frame}`).setOrigin(dir<0?1-anchor:anchor,clip.feet[pose.frame]/clip.meta.frameHeight)
      .setPosition(x,y).setFlipX(dir<0).setScale(clip.scale*(crouch&&pose.kind!=='dive'&&pose.kind!=='diveReach'&&pose.kind!=='crouch'&&pose.kind!=='crouchSlash'&&pose.kind!=='crouchBlock'&&pose.kind!=='crouchWalk'?.65:1)).setAngle(0).setVisible(true);
    if(pose.kind==='ember'||pose.kind==='ice'||pose.kind==='radiant'||pose.kind==='stone')image.setScale(clip.scale,clip.scale*(crouch?.65:1));
    if(pose.kind==='unshieldedUtility'||pose.kind==='unshieldedWalk')image.setScale(clip.scale);
    if(pose.kind==='shieldThrow'||pose.kind==='unshieldedSword')image.setScale(clip.scale,clip.scale*(crouch?.65:1));
    image.setAngle('angle' in pose?pose.angle??0:0);
    if('angle' in pose&&pose.angle){
      // Airborne sword spins turn around her body, rather than orbiting a foot.
      const centre=clip.feet[pose.frame]-(clip.meta.bodyHeight??400)/2;
      image.setOrigin(dir<0?1-anchor:anchor,centre/clip.meta.frameHeight).setPosition(x,y-48);
    }
    image.setData('heroAction',pose.kind).setData('heroFrame',pose.frame);
    return true;
  }
  renderBeam(x: number, y: number, crouch: boolean) {
    this.beam.setVisible(false);
    if(!this.attack||(this.attack.kind!=='reach'&&!(this.attack.kind==='crouchSlash'&&this.attack.extended)))return;
    const frame=this.attackFrame(),box=this.effects.get(frame);
    if(!box)return;
    const clip=this.clips.reach;
    if(!clip)return;
    const scale=clip.scale*((crouch||this.attack.kind==='crouchSlash')?.65:1),dir=this.attack.face;
    const start=Math.max(0,(box.left-clip.anchor)*scale),width=this.attack.range-start;
    // The far edge uses the very same range snapshot as the hit test. Flip
    // around the near edge for left-facing strikes; keep the body scale fixed.
    this.beam.setTexture(`hero-energy-${frame}`,'energy').setOrigin(dir<0?1:0,0).setFlipX(dir<0)
      .setPosition(x+dir*start,y+(box.top-clip.feet[frame])*scale)
      .setDisplaySize(width,(box.bottom-box.top)*scale).setVisible(true);
    this.beam.setData('reach',this.attack.range).setData('farX',x+dir*this.attack.range);
  }
}
