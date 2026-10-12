import Phaser from 'phaser';

export type StoneWounds={elapsed:number;dir?:number};
type StoneMetadata={
  frameSize:number;columns:number;origins:[number,number][];
  // Sternum and waist in each animation's cropped source frame.
  torsos:Record<string,[number,number,number,number][]>;
  zones:Record<string,[number,number][][]>;
  shards:{zone:number;offset:[number,number];scale:number;angle:number;delay:number}[];
};
export const STONE_WOUNDS_DURATION=7.35;

export function preloadZombieStones(scene:Phaser.Scene){
  const path=new URL('zombie-stones/Zombie-stones',document.baseURI).href;
  scene.load.image('zombie-stones',path+'-spritesheet.png');
  scene.load.json('zombie-stones-meta',path+'.json?v=impacts2');
}

// The wounds belong to the enemy, while these pooled images only draw them.
// Source-frame attachment points keep each shard rooted as the torso changes pose.
export class ZombieStones {
  readonly meta?:StoneMetadata;
  pool:Phaser.GameObjects.Image[]=[];
  readonly effects:Phaser.GameObjects.Graphics;
  private index=0;
  constructor(readonly scene:Phaser.Scene){
    this.effects=scene.add.graphics().setDepth(1.03);
    this.meta=scene.cache.json.get('zombie-stones-meta');
    if(!this.meta||!scene.textures.exists('zombie-stones'))return;
    const tex=scene.textures.get('zombie-stones'),size=this.meta.frameSize;
    for(let frame=0;frame<this.meta.origins.length;frame++)tex.add(frame,0,frame%this.meta.columns*size,Math.floor(frame/this.meta.columns)*size,size,size);
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  reset(){this.index=0;this.effects.clear();for(const image of this.pool)image.setVisible(false)}
  recoil(body:Phaser.GameObjects.Image,wounds?:StoneWounds,time=wounds?.elapsed??0){
    if(!wounds||time>=.34)return;
    // Three sharp backward jolts, one for each pair of rock impacts.
    let kick=0;
    for(const delay of [0,.11,.22]){const t=(time-delay)/.11;if(t>0&&t<1)kick+=Math.sin(t*Math.PI)*(1-t*.35)}
    body.x+=(wounds.dir??1)*9*kick;body.y-=1.5*kick;
  }
  render(body:Phaser.GameObjects.Image,wounds?:StoneWounds,decayAlpha?:number,time=wounds?.elapsed??0){
    if(!wounds||!body.visible||!this.meta||!this.scene.textures.exists('zombie-stones'))return;
    const torso=this.meta.torsos[body.texture.key]?.[Number(body.frame.name)];
    const zones=this.meta.zones[body.texture.key]?.[Number(body.frame.name)];
    if(!torso||!zones)return;
    const [sx,sy,wx,wy]=torso,dx=sx-wx,dy=sy-wy;
    const rotation=Math.atan2(dy,dx)+Math.PI/2,flip=body.flipX?-1:1;
    for(let i=0;i<this.meta.shards.length;i++){
      const shard=this.meta.shards[i],age=time-shard.delay;
      if(age<0)continue;
      // Corpse wound age is frozen, preserving only the shards still embedded at death.
      const alpha=body.alpha*Phaser.Math.Clamp((5.15+i*.44-wounds.elapsed)/.65,0,1)*(decayAlpha??1);
      if(alpha<=0)continue;
      const [zx,zy]=zones[shard.zone],localX=zx+shard.offset[0],localY=zy+shard.offset[1];
      const x=body.x+flip*(localX-body.displayOriginX)*body.scaleX,y=body.y+(localY-body.displayOriginY)*body.scaleY;
      let image=this.pool[this.index++];
      if(!image){image=this.scene.add.image(0,0,'zombie-stones');this.pool.push(image)}
      const frame=i%this.meta.origins.length,[ox,oy]=this.meta.origins[frame];
      image.setTexture('zombie-stones',frame).setOrigin(ox/this.meta.frameSize,oy/this.meta.frameSize)
        .setPosition(x-(wounds.dir??1)*Math.max(0,1-age/.035)*28,y)
        .setScale(body.scaleX*shard.scale).setFlipX(body.flipX)
        .setRotation(flip*(rotation+shard.angle))
        .setAlpha(alpha).setDepth(body.depth+.015).setVisible(true)
        .setData('heroAction','embeddedStone').setData('stoneOwner',body).setData('stoneIndex',i).setData('stoneZone',shard.zone);
      // A compact, distinct burst at each strike, followed by scattered rock chips.
      if(age>=.035&&age<.30){
        const t=age-.035,scale=body.scaleX/(104/389),fade=alpha*(1-t/.265),g=this.effects;
        if(t<.055){g.lineStyle(2*scale,0xf3dfb7,fade*(1-t/.055));g.strokeCircle(x,y,(3+t*90)*scale)}
        for(let chip=0;chip<5;chip++){
          const a=(chip*2.399+i*.6),r=(2+t*(55+chip*12))*scale;
          const cx=x+Math.cos(a)*r,cy=y+Math.sin(a)*r+t*t*180*scale,size=(chip%2?2:3)*scale;
          g.fillStyle(chip%2?0xd5c6ac:0x837464,fade);g.fillTriangle(cx-size,cy+size,cx,cy-size,cx+size,cy+size*.5);
        }
      }
    }
  }
}
