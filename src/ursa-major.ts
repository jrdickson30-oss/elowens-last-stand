import Phaser from 'phaser';

export const URSA_MAJOR_HEIGHT=124;
export const URSA_MAJOR_BODY='ursa-major-undead',URSA_MAJOR_WALK='ursa-major-walk',URSA_MAJOR_REMAINS='ursa-major-remains';
type Pose={rect:[number,number,number,number];anchorX:number;groundY:number;bodyHeight:number};
type Walk={frameCount:number;frameRects:[number,number,number,number][];frameAnchorX:number[];frameGroundY:number[];bodyHeight:number;durationsMs:number[]};
export type UrsaMajorMetadata={base:Pose;walk:Walk;remains:Pose};

export function preloadUrsaMajor(scene:Phaser.Scene){
 const path=new URL('ursa-major/',document.baseURI).href;
 scene.load.image(URSA_MAJOR_BODY,path+'Ursa-major-undead.png');
 scene.load.image(URSA_MAJOR_WALK,path+'Ursa-major-walk-spritesheet.png');
 scene.load.image(URSA_MAJOR_REMAINS,path+'Ursa-major-remains.png');
 scene.load.json('ursa-major-meta',path+'Ursa-major.json');
}

export class UrsaMajorAnimator{
 readonly meta?:UrsaMajorMetadata;
 constructor(readonly scene:Phaser.Scene){
  this.meta=scene.cache.json.get('ursa-major-meta');if(!this.meta)return;
  for(const [key,pose] of [[URSA_MAJOR_BODY,this.meta.base],[URSA_MAJOR_REMAINS,this.meta.remains]] as const){
   if(!scene.textures.exists(key))continue;const tex=scene.textures.get(key);tex.add('body',0,...pose.rect);tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  if(scene.textures.exists(URSA_MAJOR_WALK)){const tex=scene.textures.get(URSA_MAJOR_WALK);this.meta.walk.frameRects.forEach((rect,i)=>tex.add(i,0,...rect));tex.setFilter(Phaser.Textures.FilterMode.NEAREST);}
 }
 render(image:Phaser.GameObjects.Image,x:number,y:number,time:number,face:number){
  if(!this.meta||!this.scene.textures.exists(URSA_MAJOR_WALK))return false;
  const c=this.meta.walk,duration=c.durationsMs.reduce((a,b)=>a+b,0);let remaining=(time*1000%duration+duration)%duration,frame=0;
  while(frame<c.frameCount-1&&remaining>=c.durationsMs[frame])remaining-=c.durationsMs[frame++];
  image.setTexture(URSA_MAJOR_WALK,frame).setOrigin(c.frameAnchorX[frame]/image.frame.width,c.frameGroundY[frame]/image.frame.height)
   .setPosition(x,y).setScale(URSA_MAJOR_HEIGHT/c.bodyHeight).setFlipX(face<0).setAngle(0).setAlpha(1).setVisible(true)
   .setData('heroAction','enemy').setData('enemyGait','ursa-walk').setData('enemyHit',false);
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
