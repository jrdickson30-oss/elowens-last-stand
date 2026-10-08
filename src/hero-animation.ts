import Phaser from 'phaser';

export const SWORD_RANGE = 115;
export const SWORD_INTERVAL = .42;
type Action = 'slash' | 'thrust' | 'reach' | 'jump' | 'block' | 'walk' | 'guardWalk' | 'crouch' | 'crouchSlash' | 'crouchBlock' | 'crouchWalk' | 'ember';
type Metadata = {
  frameWidth: number; frameHeight: number; frameCount: number; columns: number;
  durationsMs: number[]; groundY?: number; anchor?: {x: number; groundY: number};
  rearFootAnchorX?: number;
  footAnchors?: number[];
  bodyHeight?: number;
  frameAnchors?: number[]; tip?: {x:number;y:number}; releaseFrame?: number;
};
type Clip = {key: string; meta: Metadata; scale: number; anchor: number; feet: number[]};
type Bounds = {left: number; top: number; right: number; bottom: number};
const assets: Record<Action, {file: string; bodyHeight: number}> = {
  ember: {file: 'ember-strike', bodyHeight: 386},
  slash: {file: 'sword-attack', bodyHeight: 191},
  thrust: {file: 'sword-thrust', bodyHeight: 174},
  reach: {file: 'strike-through', bodyHeight: 191},
  jump: {file: 'jump', bodyHeight: 188},
  block: {file: 'block', bodyHeight: 432},
  walk: {file: 'walk', bodyHeight: 454},
  guardWalk: {file: 'guard-walk', bodyHeight: 438},
  crouch: {file: 'crouch', bodyHeight: 410},
  crouchSlash: {file: 'crouch-sword-attack', bodyHeight: 432},
  crouchBlock: {file: 'crouch-block', bodyHeight: 560},
  crouchWalk: {file: 'crouch-walk', bodyHeight: 580},
};

export function preloadHeroActions(scene: Phaser.Scene) {
  for(const [id,asset] of Object.entries(assets)) {
    const path=`elowen-${asset.file}/Elowen-${asset.file}`;
    scene.load.json(`hero-${id}-meta`,new URL(path+'.json',document.baseURI).href);
    // The supplied Strike Through uses the same sword poses. Its separate
    // effect layers let us extend the energy without stretching the heroine.
    if(id!=='reach')scene.load.image(`hero-${id}`,new URL(path+'-spritesheet.png',document.baseURI).href);
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
  casting: {elapsed:number;face:number;fresh:boolean}|null=null;
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
    this.casting=null;this.attack=null;this.nextAttack='slash';this.airborne=false;this.jumpElapsed=this.landingTime=0;this.beam.setVisible(false);
  }
  startAttack(range: number, face: number, extended: boolean, crouching=false) {
    const kind=crouching&&this.clips.crouchSlash?'crouchSlash':extended?'reach':this.nextAttack;
    if(!extended&&kind!=='crouchSlash')this.nextAttack=this.nextAttack==='slash'?'thrust':'slash';
    this.attack=this.clips[kind]?{kind,elapsed:0,range,face,extended,fresh:true}:null;
  }
  startEmber(face:number) {this.attack=null;this.casting=this.clips.ember?{elapsed:0,face,fresh:true}:null;}
  emberTip(x:number,y:number,face:number,crouching:boolean) {
    const c=this.clips.ember;
    if(!c?.meta.tip)return {x:x+face*30,y:y-48};
    const f=c.meta.releaseFrame??3,anchor=c.meta.frameAnchors?.[f]??c.anchor;
    return {x:x+face*(c.meta.tip.x-anchor)*c.scale,y:y+(c.meta.tip.y-c.feet[f])*c.scale*(crouching?.65:1)};
  }
  startJump() {this.airborne=true;this.jumpElapsed=0;this.landingTime=0;}
  blockedHit() {if(this.clips.block||this.clips.crouchBlock)this.blockImpact=0;}
  tick(dt: number, y: number, ground: number, blocking: boolean, playing: boolean, moving=false, crouching=false) {
    if(!playing){this.reset();return}
    if(this.casting){
      if(this.casting.fresh)this.casting.fresh=false;else this.casting.elapsed+=dt;
      if(this.casting.elapsed>=.36)this.casting=null;
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
    if(this.casting&&this.clips.ember){
      let elapsed=this.casting.elapsed*1000,frame=0;
      const durations=this.clips.ember.meta.durationsMs;
      while(frame<durations.length-1&&elapsed>=durations[frame]){elapsed-=durations[frame];frame++}
      return {kind:'ember' as const,frame,face:this.casting.face};
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
  render(image: Phaser.GameObjects.Image, x: number, y: number, face: number, vy: number, crouch: boolean) {
    const pose=this.pose(vy);if(!pose)return false;
    const clip=this.clips[pose.kind]!,dir=pose.face??face;
    const anchor=(clip.meta.frameAnchors?.[pose.frame]??clip.anchor)/clip.meta.frameWidth;
    image.setTexture(clip.key,`pose-${pose.frame}`).setOrigin(dir<0?1-anchor:anchor,clip.feet[pose.frame]/clip.meta.frameHeight)
      .setPosition(x,y).setFlipX(dir<0).setScale(clip.scale*(crouch&&pose.kind!=='crouch'&&pose.kind!=='crouchSlash'&&pose.kind!=='crouchBlock'&&pose.kind!=='crouchWalk'?.65:1)).setAngle(0).setVisible(true);
    if(pose.kind==='ember')image.setScale(clip.scale,clip.scale*(crouch?.65:1));
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
