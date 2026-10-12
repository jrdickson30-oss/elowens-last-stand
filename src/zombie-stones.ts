import Phaser from 'phaser';

export type StoneWounds={elapsed:number};
type StoneMetadata={
  frameSize:number;columns:number;origins:[number,number][];
  // Sternum and waist in each animation's cropped source frame.
  torsos:Record<string,[number,number,number,number][]>;
};
export const STONE_WOUNDS_DURATION=7.35;

export function preloadZombieStones(scene:Phaser.Scene){
  const path=new URL('zombie-stones/Zombie-stones',document.baseURI).href;
  scene.load.image('zombie-stones',path+'-spritesheet.png');
  scene.load.json('zombie-stones-meta',path+'.json');
}

// The wounds belong to the enemy, while these pooled images only draw them.
// Source-frame attachment points keep each shard rooted as the torso changes pose.
export class ZombieStones {
  readonly meta?:StoneMetadata;
  pool:Phaser.GameObjects.Image[]=[];
  private index=0;
  constructor(readonly scene:Phaser.Scene){
    this.meta=scene.cache.json.get('zombie-stones-meta');
    if(!this.meta||!scene.textures.exists('zombie-stones'))return;
    const tex=scene.textures.get('zombie-stones'),size=this.meta.frameSize;
    for(let frame=0;frame<this.meta.origins.length;frame++)tex.add(frame,0,frame%this.meta.columns*size,Math.floor(frame/this.meta.columns)*size,size,size);
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  reset(){this.index=0;for(const image of this.pool)image.setVisible(false)}
  render(body:Phaser.GameObjects.Image,wounds?:StoneWounds,decayAlpha?:number){
    if(!wounds||!body.visible||!this.meta||!this.scene.textures.exists('zombie-stones'))return;
    const torso=this.meta.torsos[body.texture.key]?.[Number(body.frame.name)];
    if(!torso)return;
    const [sx,sy,wx,wy]=torso,dx=sx-wx,dy=sy-wy;
    const rotation=Math.atan2(dy,dx)+Math.PI/2,flip=body.flipX?-1:1;
    for(let i=0;i<5;i++){
      // Corpse wound age is frozen, preserving only the shards still embedded at death.
      const alpha=body.alpha*Phaser.Math.Clamp((5.15+i*.55-wounds.elapsed)/.65,0,1)*(decayAlpha??1);
      if(alpha<=0)continue;
      const t=[.08,.34,.60,.87,1.18][i],inset=[-8,6,-5,5,-2][i];
      const localX=sx+(wx-sx)*t+Math.cos(rotation)*inset;
      const localY=sy+(wy-sy)*t+Math.sin(rotation)*inset;
      let image=this.pool[this.index++];
      if(!image){image=this.scene.add.image(0,0,'zombie-stones');this.pool.push(image)}
      const frame=i%this.meta.origins.length,[ox,oy]=this.meta.origins[frame];
      image.setTexture('zombie-stones',frame).setOrigin(ox/this.meta.frameSize,oy/this.meta.frameSize)
        .setPosition(body.x+flip*(localX-body.displayOriginX)*body.scaleX,body.y+(localY-body.displayOriginY)*body.scaleY)
        .setScale(body.scaleX*[.078,.067,.086,.071,.062][i]).setFlipX(body.flipX)
        .setRotation(flip*(rotation+[-.12,.09,-.08,.16,-.1][i]))
        .setAlpha(alpha).setDepth(body.depth+.015).setVisible(true)
        .setData('heroAction','embeddedStone').setData('stoneOwner',body).setData('stoneIndex',i);
    }
  }
}
