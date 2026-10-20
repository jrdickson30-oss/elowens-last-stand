import Phaser from 'phaser';
import {ZOMBIE_BLOCK_DURATION,type ZombieClaw,type ZombieBlock} from './zombie-attack';

export const ZOMBIE_HIT_DURATION=.42;
export const ZOMBIE_STAGGER_DURATION=.72;
export const ZOMBIE_FAST_SPEED=75;
export type ZombieHit={elapsed:number;dir:number;fresh?:boolean;kind?:'heavy'};
export const zombieHitDuration=(hit?:ZombieHit)=>hit?.kind==='heavy'?ZOMBIE_STAGGER_DURATION:ZOMBIE_HIT_DURATION;
export type ZombieMotion={moving:boolean;fast:boolean;idleElapsed?:number;idle?:boolean;blocked?:ZombieBlock};
export const ZOMBIE_EXTRA_ACTIONS=['backhand','blocked','idle','stagger','fast-walk'] as const;
export const ZOMBIE_FAMILIES=['zombie','fast-zombie'] as const;
export type ZombieFamily=typeof ZOMBIE_FAMILIES[number];
export const isAnimatedZombie=(kind:number)=>kind===0||kind===1;

type WalkClip = {
  frameWidth: number; frameHeight: number; frameCount: number; columns: number;
  bodyHeight: number; displayHeight: number; durationsMs: number[];
  frameAnchorX: number[]; frameGroundY: number[];
  frameRects?:[number,number,number,number][];
};

export function preloadZombieWalk(scene: Phaser.Scene) {
  for(const family of ZOMBIE_FAMILIES)for(const action of ['walk','hit','claw',...ZOMBIE_EXTRA_ACTIONS]) {
    const path=new URL(`${family}-${action}/${family==='zombie'?'Zombie':'Fast-zombie'}-${action}`,document.baseURI).href;
    const revised=family==='fast-zombie'&&['claw','backhand'].includes(action);
    scene.load.image(`${family}-${action}`,path+(revised?'-spritesheet-v2.png':'-spritesheet.png'));
    scene.load.json(`${family}-${action}-meta`,path+'.json'+(revised?'?v=collapse2':''));
  }
}

// Independent clips keep the slow shuffle, faster gait and combat reactions distinct.
export class ZombieAnimator {
  readonly clip: WalkClip|undefined;
  readonly hitClip: WalkClip|undefined;
  readonly clawClip: WalkClip|undefined;
  readonly extra:Partial<Record<typeof ZOMBIE_EXTRA_ACTIONS[number],WalkClip>>={};
  constructor(readonly scene: Phaser.Scene,readonly family:ZombieFamily='zombie') {
    this.clip=scene.cache.json.get(`${family}-walk-meta`) as WalkClip|undefined;
    this.hitClip=scene.cache.json.get(`${family}-hit-meta`) as WalkClip|undefined;
    this.clawClip=scene.cache.json.get(`${family}-claw-meta`) as WalkClip|undefined;
    for(const action of ZOMBIE_EXTRA_ACTIONS)this.extra[action]=scene.cache.json.get(`${family}-${action}-meta`);
    for(const [key,clip] of [[`${family}-walk`,this.clip],[`${family}-hit`,this.hitClip],[`${family}-claw`,this.clawClip],...ZOMBIE_EXTRA_ACTIONS.map(action=>[`${family}-${action}`,this.extra[action]] as const)] as const) {
      if(!clip||!scene.textures.exists(key))continue;
      const texture=scene.textures.get(key);
      for(let frame=0;frame<clip.frameCount;frame++)texture.add(frame,0,...(clip.frameRects?.[frame]??[
        frame%clip.columns*clip.frameWidth,Math.floor(frame/clip.columns)*clip.frameHeight,
        clip.frameWidth,clip.frameHeight]) as [number,number,number,number]);
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
  // Other enemy types keep their own artwork and recoil around their feet.
  applyHit(image: Phaser.GameObjects.Image,x: number,hit: ZombieHit) {
    const progress=Phaser.Math.Clamp(hit.elapsed/zombieHitDuration(hit),0,1);
    const strength=progress<.2?Math.sin(progress/.2*Math.PI/2):(.5+.5*Math.cos((progress-.2)/.8*Math.PI));
    image.setX(x+hit.dir*6*strength).setAngle(hit.dir*13*strength)
      .setData('enemyHit',true).setData('enemyGait','recoil');
  }
  render(image: Phaser.GameObjects.Image,x: number,y: number,time: number,face: number,hit?: ZombieHit,attack?:ZombieClaw,motion?:ZombieMotion) {
    const action=hit?(hit.kind==='heavy'?'stagger':'hit'):motion?.blocked?'blocked':attack?(attack.variant??'claw'):motion?.idle?'idle':motion?.moving&&motion.fast?'fast-walk':'walk';
    const clip=action==='walk'?this.clip:action==='hit'?this.hitClip:action==='claw'?this.clawClip:this.extra[action],key=`${this.family}-${action}`;
    if(!clip||!this.scene.textures.exists(key))return false;
    const duration=clip.durationsMs.reduce((sum,ms)=>sum+ms,0);
    const elapsed=hit?hit.elapsed/zombieHitDuration(hit)*duration:motion?.blocked?motion.blocked.elapsed/ZOMBIE_BLOCK_DURATION*duration:attack?attack.elapsed/(attack.duration??duration/1000)*duration:((motion?.idle?motion.idleElapsed??0:time)*1000%duration+duration)%duration;
    let remaining=Math.min(elapsed,duration-1),frame=0;
    while(frame<clip.frameCount-1&&remaining>=clip.durationsMs[frame])remaining-=clip.durationsMs[frame++];
    image.setTexture(key,frame)
      .setOrigin(clip.frameAnchorX[frame]/image.frame.width,clip.frameGroundY[frame]/image.frame.height)
      .setPosition(x,y).setScale(clip.displayHeight/clip.bodyHeight)
      .setFlipX((hit?-hit.dir:motion?.blocked?motion.blocked.face:attack?attack.face:face)<0).setAngle(0).setVisible(true).setData('heroAction','enemy')
      .setData('enemyGait',action==='walk'?'shuffle':action==='hit'?'recoil':action).setData('enemyHit',!!hit);
    return true;
  }
}
