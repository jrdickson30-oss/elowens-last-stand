import Phaser from 'phaser';
import type {ZombieClaw} from './zombie-attack';

export const URSA_MAJOR_HEIGHT=124;
export const URSA_MAJOR_ATTACK_DURATION=1.2,URSA_MAJOR_ATTACK_IMPACT=.6,URSA_MAJOR_ATTACK_COOLDOWN=1.35;
export const URSA_MAJOR_BODY='ursa-major-undead',URSA_MAJOR_WALK='ursa-major-walk',URSA_MAJOR_REMAINS='ursa-major-remains';
export const URSA_MAJOR_ATTACKS={sword:'ursa-major-sword-attack',claw:'ursa-major-claw-attack'} as const;
type Pose={rect:[number,number,number,number];anchorX:number;groundY:number;bodyHeight:number};
type Walk={frameCount:number;frameRects:[number,number,number,number][];frameAnchorX:number[];frameGroundY:number[];bodyHeight:number;frameBodyHeights?:number[];durationsMs:number[]};
export type UrsaMajorMetadata={base:Pose;walk:Walk;remains:Pose;attacks:Record<keyof typeof URSA_MAJOR_ATTACKS,Walk>};

export function preloadUrsaMajor(scene:Phaser.Scene){
 const path=new URL('ursa-major/',document.baseURI).href;
 scene.load.image(URSA_MAJOR_BODY,path+'Ursa-major-undead.png');
 scene.load.image(URSA_MAJOR_WALK,path+'Ursa-major-walk-spritesheet-v2.png');
 scene.load.image(URSA_MAJOR_REMAINS,path+'Ursa-major-remains.png');
 scene.load.image(URSA_MAJOR_ATTACKS.sword,path+'Ursa-major-sword-attack-spritesheet.png');
 scene.load.image(URSA_MAJOR_ATTACKS.claw,path+'Ursa-major-claw-attack-spritesheet.png');
 scene.load.json('ursa-major-meta',path+'Ursa-major.json?v=ursa-motion2');
}

export class UrsaMajorAnimator{
 readonly meta?:UrsaMajorMetadata;
 constructor(readonly scene:Phaser.Scene){
  this.meta=scene.cache.json.get('ursa-major-meta');if(!this.meta)return;
  for(const [key,pose] of [[URSA_MAJOR_BODY,this.meta.base],[URSA_MAJOR_REMAINS,this.meta.remains]] as const){
   if(!scene.textures.exists(key))continue;const tex=scene.textures.get(key);tex.add('body',0,...pose.rect);tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  for(const [key,clip] of [[URSA_MAJOR_WALK,this.meta.walk],...Object.entries(URSA_MAJOR_ATTACKS).map(([action,key])=>[key,this.meta!.attacks[action as keyof typeof URSA_MAJOR_ATTACKS]] as const)] as const){
   if(!clip||!scene.textures.exists(key))continue;const tex=scene.textures.get(key);clip.frameRects.forEach((rect,i)=>tex.add(i,0,...rect));tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
 }
 render(image:Phaser.GameObjects.Image,x:number,y:number,time:number,face:number,attack?:ZombieClaw){
  if(!this.meta||!this.scene.textures.exists(URSA_MAJOR_WALK))return false;
  const action=attack?.ursaAttack,c=action?this.meta.attacks[action]:this.meta.walk,key=action?URSA_MAJOR_ATTACKS[action]:URSA_MAJOR_WALK;
  const duration=c.durationsMs.reduce((a,b)=>a+b,0);let remaining=action?Math.min(duration-1,attack!.elapsed/(attack!.duration??URSA_MAJOR_ATTACK_DURATION)*duration):(time*1000%duration+duration)%duration,frame=0;
  while(frame<c.frameCount-1&&remaining>=c.durationsMs[frame])remaining-=c.durationsMs[frame++];
  image.setTexture(key,frame).setOrigin(c.frameAnchorX[frame]/image.frame.width,c.frameGroundY[frame]/image.frame.height)
   .setPosition(x,y).setScale(URSA_MAJOR_HEIGHT/(c.frameBodyHeights?.[frame]??c.bodyHeight)).setFlipX((action?attack!.face:face)<0).setAngle(0).setAlpha(1).setVisible(true)
   .setData('heroAction','enemy').setData('enemyGait',action?'ursa-'+action:'ursa-walk').setData('enemyHit',false);
  return true;
 }
}

export function renderUrsaMajorRemains(scene:Phaser.Scene,image:Phaser.GameObjects.Image,x:number,y:number,dir:number,alpha:number){
 const meta=scene.cache.json.get('ursa-major-meta') as UrsaMajorMetadata|undefined;
 if(!meta||!scene.textures.exists(URSA_MAJOR_REMAINS))return false;const c=meta.remains;
 image.setTexture(URSA_MAJOR_REMAINS,'body').setOrigin(c.anchorX/image.frame.width,c.groundY/image.frame.height)
  .setPosition(x+dir*URSA_MAJOR_HEIGHT*.5,y).setScale(URSA_MAJOR_HEIGHT/c.bodyHeight).setFlipX(dir>0).setAngle(0).setAlpha(alpha).setVisible(alpha>0).setData('heroAction','corpse');
 return true;
}
