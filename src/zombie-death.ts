import Phaser from 'phaser';
import type { StoneWounds } from './zombie-stones';
import {ZOMBIE_FAMILIES,type ZombieFamily} from './zombie-animation';

export const ZOMBIE_FALL_DURATION=.7;
export const FAST_ZOMBIE_FALL_DURATION=.96;
const SETTLE_DURATION=.18,DECOMPOSE_DURATION=1.2,BONES_HOLD=1.5,FADE_DURATION=.6;
export const ZOMBIE_BONES_AT=ZOMBIE_FALL_DURATION+SETTLE_DURATION+DECOMPOSE_DURATION;
export const ZOMBIE_DEATH_DURATION=ZOMBIE_BONES_AT+BONES_HOLD+FADE_DURATION;
export const ZOMBIE_IGNITE_DURATION=1.2,ZOMBIE_BURNOUT_DURATION=1.6;
export const ZOMBIE_ASH_AT=ZOMBIE_IGNITE_DURATION+ZOMBIE_BURNOUT_DURATION;
export const ZOMBIE_BURN_DEATH_DURATION=ZOMBIE_ASH_AT+BONES_HOLD+FADE_DURATION;
export type ZombieDeathVariant='fall'|'severed'|'burn'|'radiant'|'stone';
export type ZombieCorpse={x:number;y:number;dir:number;facing?:number;kind:number;elapsed:number;variant?:ZombieDeathVariant;stoneWounds?:StoneWounds};
export const zombieRemainsAt=(corpse:ZombieCorpse)=>corpse.variant==='burn'?ZOMBIE_ASH_AT:(corpse.kind===1?FAST_ZOMBIE_FALL_DURATION:ZOMBIE_FALL_DURATION)+SETTLE_DURATION+DECOMPOSE_DURATION;
export const zombieDeathDuration=(corpse:ZombieCorpse)=>zombieRemainsAt(corpse)+BONES_HOLD+FADE_DURATION;
type DeathClip={
  frameWidth:number;frameHeight:number;frameCount:number;columns:number;
  bodyHeight:number;displayHeight:number;durationsMs:number[];
  frameAnchorX:number[];frameGroundY:number[];
  frameRects?:[number,number,number,number][];
};

export function preloadZombieDeath(scene:Phaser.Scene) {
  for(const family of ZOMBIE_FAMILIES)for(const action of ['fall','decompose','severed-fall','severed-decompose','burn-ignite','burn-out','radiant-fall']) {
    const path=new URL(`${family}-${action}/${family==='zombie'?'Zombie':'Fast-zombie'}-${action}`,document.baseURI).href;
    scene.load.image(`${family}-${action}`,path+(family==='fast-zombie'?'-spritesheet-v2.png':'-spritesheet.png'));
    scene.load.json(`${family}-${action}-meta`,path+'.json'+(family==='fast-zombie'?'?v=collapse2':''));
  }
}

export class ZombieDeathAnimator {
  readonly fall?:DeathClip;
  readonly decompose?:DeathClip;
  readonly severedFall?:DeathClip;
  readonly severedDecompose?:DeathClip;
  readonly burnIgnite?:DeathClip;
  readonly burnOut?:DeathClip;
  readonly radiantFall?:DeathClip;
  constructor(readonly scene:Phaser.Scene,readonly family:ZombieFamily='zombie') {
    this.fall=scene.cache.json.get(`${this.family}-fall-meta`) as DeathClip|undefined;
    this.decompose=scene.cache.json.get(`${this.family}-decompose-meta`) as DeathClip|undefined;
    this.severedFall=scene.cache.json.get(`${this.family}-severed-fall-meta`) as DeathClip|undefined;
    this.severedDecompose=scene.cache.json.get(`${this.family}-severed-decompose-meta`) as DeathClip|undefined;
    this.burnIgnite=scene.cache.json.get(`${this.family}-burn-ignite-meta`) as DeathClip|undefined;
    this.burnOut=scene.cache.json.get(`${this.family}-burn-out-meta`) as DeathClip|undefined;
    this.radiantFall=scene.cache.json.get(`${this.family}-radiant-fall-meta`) as DeathClip|undefined;
    for(const [key,clip] of [[`${this.family}-fall`,this.fall],[`${this.family}-decompose`,this.decompose],[`${this.family}-severed-fall`,this.severedFall],[`${this.family}-severed-decompose`,this.severedDecompose],[`${this.family}-burn-ignite`,this.burnIgnite],[`${this.family}-burn-out`,this.burnOut],[`${this.family}-radiant-fall`,this.radiantFall]] as const) {
      if(!clip||!scene.textures.exists(key))continue;
      const texture=scene.textures.get(key);
      for(let frame=0;frame<clip.frameCount;frame++) {
        const rect=clip.frameRects?.[frame]??[frame%clip.columns*clip.frameWidth,Math.floor(frame/clip.columns)*clip.frameHeight,clip.frameWidth,clip.frameHeight];
        texture.add(frame,0,...rect as [number,number,number,number]);
      }
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
  private pose(image:Phaser.GameObjects.Image,key:string,clip:DeathClip,frame:number,x:number,y:number,dir:number,alpha:number,scale=clip.displayHeight/clip.bodyHeight) {
    image.setTexture(key,frame).setOrigin(clip.frameAnchorX[frame]/image.frame.width,clip.frameGroundY[frame]/image.frame.height)
      .setPosition(x,y).setScale(scale).setFlipX(dir>0).setAngle(0).setAlpha(alpha).setVisible(alpha>0)
      .setData('heroAction','corpse');
  }
  render(body:Phaser.GameObjects.Image,next:Phaser.GameObjects.Image,corpse:ZombieCorpse,groundY:number) {
    if(corpse.kind===(this.family==='fast-zombie'?1:0)&&corpse.variant==='burn'&&this.burnIgnite&&this.burnOut&&this.scene.textures.exists(`${this.family}-burn-ignite`)&&this.scene.textures.exists(`${this.family}-burn-out`)) {
      this.renderBurn(body,next,corpse,groundY,this.burnIgnite,this.burnOut);return;
    }
    const fallDuration=corpse.kind===1?FAST_ZOMBIE_FALL_DURATION:ZOMBIE_FALL_DURATION,bonesAt=zombieRemainsAt(corpse);
    const poseDir=corpse.facing===undefined?corpse.dir:-corpse.facing;
    const t=corpse.elapsed,p=Phaser.Math.Clamp(t/fallDuration,0,1);
    const distance=corpse.variant==='radiant'?32:corpse.variant==='stone'?20:12;
    const x=corpse.x+corpse.dir*distance*(1-(1-p)**2),y=Phaser.Math.Linear(corpse.y,groundY,p);
    const dissolve=Phaser.Math.Clamp((t-fallDuration-SETTLE_DURATION)/DECOMPOSE_DURATION,0,1);
    const alpha=1-Phaser.Math.Clamp((t-bonesAt-BONES_HOLD)/FADE_DURATION,0,1);
    const stage=t<fallDuration?'fall':t<fallDuration+SETTLE_DURATION?'settle':t<bonesAt?'decompose':t<bonesAt+BONES_HOLD?'bones':'fade';
    body.setData('corpseStage',stage);next.setData('corpseStage',stage);
    next.setVisible(false);
    const severed=corpse.kind===(this.family==='fast-zombie'?1:0)&&corpse.variant==='severed'&&this.severedFall&&this.severedDecompose&&this.scene.textures.exists(`${this.family}-severed-fall`)&&this.scene.textures.exists(`${this.family}-severed-decompose`);
    const radiant=corpse.kind===(this.family==='fast-zombie'?1:0)&&corpse.variant==='radiant'&&this.radiantFall&&this.scene.textures.exists(`${this.family}-radiant-fall`);
    const fall=severed?this.severedFall:radiant?this.radiantFall:this.fall,decompose=severed?this.severedDecompose:this.decompose;
    const fallKey=severed?`${this.family}-severed-fall`:radiant?`${this.family}-radiant-fall`:`${this.family}-fall`,decomposeKey=severed?`${this.family}-severed-decompose`:`${this.family}-decompose`;
    if(corpse.kind===(this.family==='fast-zombie'?1:0)&&fall&&decompose&&this.scene.textures.exists(fallKey)&&this.scene.textures.exists(decomposeKey)) {
      // Keep the radiant fall's body scale as its intact corpse becomes bones.
      const decomposeScale=radiant?fall.displayHeight/fall.bodyHeight:undefined;
      if(t<fallDuration) {
        const total=fall.durationsMs.reduce((a,b)=>a+b,0);
        let remaining=p*total,frame=0;
        while(frame<fall.frameCount-1&&remaining>=fall.durationsMs[frame])remaining-=fall.durationsMs[frame++];
        this.pose(body,fallKey,fall,frame,x,y,poseDir,1);
      }else if(t<fallDuration+SETTLE_DURATION) {
        // Blend the two sheets at the grounded pose so decomposition starts smoothly.
        const mix=(t-fallDuration)/SETTLE_DURATION;
        this.pose(body,fallKey,fall,fall.frameCount-1,x,groundY,poseDir,1-mix);
        this.pose(next,decomposeKey,decompose,0,x,groundY,poseDir,mix,decomposeScale);
      }else {
        // Crossfade adjacent decomposition poses; the bones stay opaque until cleanup.
        const position=dissolve*(decompose.frameCount-1),frame=Math.floor(position),mix=position-frame;
        this.pose(body,decomposeKey,decompose,frame,x,groundY,poseDir,alpha*(1-mix),decomposeScale);
        if(frame<decompose.frameCount-1)this.pose(next,decomposeKey,decompose,frame+1,x,groundY,poseDir,alpha*mix,decomposeScale);
      }
      return;
    }
    // Preserve each other enemy's own body/armour while it falls, then dissolve to bones.
    if(!this.scene.textures.exists('characters')){body.setVisible(false);return;}
    const height=corpse.kind===2?124:104,rotation=corpse.dir*90*(p*p*(3-2*p));
    body.setTexture('characters','figure'+(corpse.kind+1)).setOrigin(.5,1).setFlipX(corpse.dir>0);
    body.setDisplaySize(height*body.frame.width/body.frame.height,height);
    body.setPosition(x,y-Math.sin(Math.abs(rotation)*Math.PI/180)*body.displayWidth/2)
      .setAngle(rotation).setAlpha(alpha*(1-dissolve)).setVisible(dissolve<1).setData('heroAction','corpse');
    if(decompose&&this.scene.textures.exists(`${this.family}-decompose`)) {
      const frame=decompose.frameCount-1,scale=height/480;
      const bonesX=x+corpse.dir*(495-decompose.frameAnchorX[frame])*scale;
      this.pose(next,`${this.family}-decompose`,decompose,frame,bonesX,groundY,corpse.dir,alpha*dissolve,scale);
    }else body.setAlpha(alpha*(1-dissolve));
  }
  private renderBurn(body:Phaser.GameObjects.Image,next:Phaser.GameObjects.Image,corpse:ZombieCorpse,groundY:number,ignite:DeathClip,out:DeathClip) {
    const poseDir=corpse.facing===undefined?corpse.dir:-corpse.facing;
    const t=corpse.elapsed,p=Phaser.Math.Clamp(t/ZOMBIE_IGNITE_DURATION,0,1);
    const x=corpse.x+corpse.dir*12*(1-(1-p)**2),y=Phaser.Math.Linear(corpse.y,groundY,Phaser.Math.Clamp(t/(corpse.kind===1?FAST_ZOMBIE_FALL_DURATION:ZOMBIE_FALL_DURATION),0,1));
    const stage=t<ZOMBIE_IGNITE_DURATION?'ignite':t<ZOMBIE_ASH_AT?'burnout':t<ZOMBIE_ASH_AT+BONES_HOLD?'ash':'fade';
    body.setData('corpseStage',stage);next.setData('corpseStage',stage);next.setVisible(false);
    if(t<ZOMBIE_IGNITE_DURATION) {
      const total=ignite.durationsMs.reduce((a,b)=>a+b,0);let remaining=p*total,frame=0;
      while(frame<ignite.frameCount-1&&remaining>=ignite.durationsMs[frame])remaining-=ignite.durationsMs[frame++];
      this.pose(body,`${this.family}-burn-ignite`,ignite,frame,x,y,poseDir,1);
    }else if(t<ZOMBIE_IGNITE_DURATION+SETTLE_DURATION) {
      const mix=(t-ZOMBIE_IGNITE_DURATION)/SETTLE_DURATION;
      this.pose(body,`${this.family}-burn-ignite`,ignite,ignite.frameCount-1,x,groundY,poseDir,1-mix);
      this.pose(next,`${this.family}-burn-out`,out,0,x,groundY,poseDir,mix);
    }else {
      const progress=Phaser.Math.Clamp((t-ZOMBIE_IGNITE_DURATION-SETTLE_DURATION)/(ZOMBIE_BURNOUT_DURATION-SETTLE_DURATION),0,1);
      const position=progress*(out.frameCount-1),frame=Math.floor(position),mix=position-frame;
      const alpha=1-Phaser.Math.Clamp((t-ZOMBIE_ASH_AT-BONES_HOLD)/FADE_DURATION,0,1);
      this.pose(body,`${this.family}-burn-out`,out,frame,x,groundY,poseDir,alpha*(1-mix));
      if(frame<out.frameCount-1)this.pose(next,`${this.family}-burn-out`,out,frame+1,x,groundY,poseDir,alpha*mix);
    }
  }
}
