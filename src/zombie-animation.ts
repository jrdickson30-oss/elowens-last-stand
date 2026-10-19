import Phaser from 'phaser';
import {ZOMBIE_CLAW_DURATION,type ZombieClaw} from './zombie-attack';

export const ZOMBIE_HIT_DURATION=.42;
export type ZombieHit={elapsed:number;dir:number;fresh?:boolean};

type WalkClip = {
  frameWidth: number; frameHeight: number; frameCount: number; columns: number;
  bodyHeight: number; displayHeight: number; durationsMs: number[];
  frameAnchorX: number[]; frameGroundY: number[];
  frameRects?:[number,number,number,number][];
};

export function preloadZombieWalk(scene: Phaser.Scene) {
  for(const action of ['walk','hit','claw']) {
    const path=new URL(`zombie-${action}/Zombie-${action}`,document.baseURI).href;
    scene.load.image(`zombie-${action}`,path+'-spritesheet.png');
    scene.load.json(`zombie-${action}-meta`,path+'.json');
  }
}

// The standard enemy's slow, one-arm shuffle is a separate clip so a later
// two-arm fast gait can be added without altering this animation.
export class ZombieAnimator {
  readonly clip: WalkClip|undefined;
  readonly hitClip: WalkClip|undefined;
  readonly clawClip: WalkClip|undefined;
  constructor(readonly scene: Phaser.Scene) {
    this.clip=scene.cache.json.get('zombie-walk-meta') as WalkClip|undefined;
    this.hitClip=scene.cache.json.get('zombie-hit-meta') as WalkClip|undefined;
    this.clawClip=scene.cache.json.get('zombie-claw-meta') as WalkClip|undefined;
    for(const [key,clip] of [['zombie-walk',this.clip],['zombie-hit',this.hitClip],['zombie-claw',this.clawClip]] as const) {
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
    const progress=Phaser.Math.Clamp(hit.elapsed/ZOMBIE_HIT_DURATION,0,1);
    const strength=progress<.2?Math.sin(progress/.2*Math.PI/2):(.5+.5*Math.cos((progress-.2)/.8*Math.PI));
    image.setX(x+hit.dir*6*strength).setAngle(hit.dir*13*strength)
      .setData('enemyHit',true).setData('enemyGait','recoil');
  }
  render(image: Phaser.GameObjects.Image,x: number,y: number,time: number,face: number,hit?: ZombieHit,attack?:ZombieClaw) {
    const hasHit=!!hit&&!!this.hitClip&&this.scene.textures.exists('zombie-hit');
    const hasClaw=!hit&&!!attack&&!!this.clawClip&&this.scene.textures.exists('zombie-claw');
    const clip=hasHit?this.hitClip:hasClaw?this.clawClip:this.clip,key=hasHit?'zombie-hit':hasClaw?'zombie-claw':'zombie-walk';
    if(!clip||!this.scene.textures.exists(key))return false;
    const duration=clip.durationsMs.reduce((sum,ms)=>sum+ms,0);
    let remaining=hasHit?Math.min(hit!.elapsed/ZOMBIE_HIT_DURATION*duration,duration-1):hasClaw?Math.min(attack!.elapsed/ZOMBIE_CLAW_DURATION*duration,duration-1):((time*1000)%duration+duration)%duration,frame=0;
    while(frame<clip.frameCount-1&&remaining>=clip.durationsMs[frame])remaining-=clip.durationsMs[frame++];
    image.setTexture(key,frame)
      .setOrigin(clip.frameAnchorX[frame]/image.frame.width,clip.frameGroundY[frame]/image.frame.height)
      .setPosition(x,y).setScale(clip.displayHeight/clip.bodyHeight)
      .setFlipX((hasHit?-hit!.dir:hasClaw?attack!.face:face)<0).setAngle(0).setVisible(true).setData('heroAction','enemy')
      .setData('enemyGait',hit?'recoil':hasClaw?'claw':'shuffle').setData('enemyHit',!!hit);
    if(hit&&!hasHit)this.applyHit(image,x,hit);
    return true;
  }
}
