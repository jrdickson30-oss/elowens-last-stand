import Phaser from 'phaser';

type WalkClip = {
  frameWidth: number; frameHeight: number; frameCount: number; columns: number;
  bodyHeight: number; displayHeight: number; durationsMs: number[];
  frameAnchorX: number[]; frameGroundY: number[];
};

export function preloadZombieWalk(scene: Phaser.Scene) {
  const path=new URL('zombie-walk/Zombie-walk',document.baseURI).href;
  scene.load.image('zombie-walk',path+'-spritesheet.png');
  scene.load.json('zombie-walk-meta',path+'.json');
}

// The standard enemy's slow, one-arm shuffle is a separate clip so a later
// two-arm fast gait can be added without altering this animation.
export class ZombieAnimator {
  readonly clip: WalkClip|undefined;
  constructor(readonly scene: Phaser.Scene) {
    this.clip=scene.cache.json.get('zombie-walk-meta') as WalkClip|undefined;
    if(!this.clip||!scene.textures.exists('zombie-walk'))return;
    const texture=scene.textures.get('zombie-walk'),clip=this.clip;
    for(let frame=0;frame<clip.frameCount;frame++)texture.add(frame,0,
      frame%clip.columns*clip.frameWidth,Math.floor(frame/clip.columns)*clip.frameHeight,
      clip.frameWidth,clip.frameHeight);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  render(image: Phaser.GameObjects.Image,x: number,y: number,time: number,face: number) {
    const clip=this.clip;
    if(!clip||!this.scene.textures.exists('zombie-walk'))return false;
    const duration=clip.durationsMs.reduce((sum,ms)=>sum+ms,0);
    let remaining=((time*1000)%duration+duration)%duration,frame=0;
    while(frame<clip.frameCount-1&&remaining>=clip.durationsMs[frame])remaining-=clip.durationsMs[frame++];
    image.setTexture('zombie-walk',frame)
      .setOrigin(clip.frameAnchorX[frame]/clip.frameWidth,clip.frameGroundY[frame]/clip.frameHeight)
      .setPosition(x,y).setScale(clip.displayHeight/clip.bodyHeight)
      .setFlipX(face<0).setAngle(0).setVisible(true).setData('heroAction','enemy')
      .setData('enemyGait','shuffle');
    return true;
  }
}
