import Phaser from 'phaser';
import { VILLAGER_CLIPS } from './villager-clips';

export function preloadVillagers(scene: Phaser.Scene) {
  for(const clip of VILLAGER_CLIPS)scene.load.spritesheet(`villager-${clip.id}`,
    new URL(`villagers/running/${clip.image}`,document.baseURI).href,
    {frameWidth:clip.frameWidth,frameHeight:clip.frameHeight,endFrame:clip.frameCount-1});
}

export class VillagerAnimator {
  readonly clips=VILLAGER_CLIPS;
  constructor(readonly scene: Phaser.Scene) {
    for(const clip of this.clips)scene.textures.get(`villager-${clip.id}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  // Sample without replacement so each group contains five different villagers.
  choose(count: number) {
    return Phaser.Utils.Array.Shuffle(this.clips.map(c=>c.id)).slice(0,count);
  }
  render(image: Phaser.GameObjects.Image,id: string,x: number,y: number,time: number) {
    const clip=this.clips.find(c=>c.id===id);
    if(!clip)return false;
    const duration=clip.durationsMs.reduce((sum,ms)=>sum+ms,0);
    let remaining=((time*1000)%duration+duration)%duration,frame=0;
    while(frame<clip.frameCount-1&&remaining>=clip.durationsMs[frame])remaining-=clip.durationsMs[frame++];
    image.setTexture(`villager-${id}`,frame)
      .setOrigin(clip.anchor.x/clip.frameWidth,clip.frameGroundY[frame]/clip.frameHeight)
      .setPosition(x,y).setScale(clip.displayHeight/clip.bodyHeight)
      .setFlipX(clip.frameFlipX[frame]).setAngle(0).setVisible(true)
      .setData('heroAction','villager').setData('villagerId',id);
    return true;
  }
}
