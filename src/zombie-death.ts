import Phaser from 'phaser';

export const ZOMBIE_FALL_DURATION=.7;
const SETTLE_DURATION=.18,DECOMPOSE_DURATION=1.2,BONES_HOLD=1.5,FADE_DURATION=.6;
export const ZOMBIE_BONES_AT=ZOMBIE_FALL_DURATION+SETTLE_DURATION+DECOMPOSE_DURATION;
export const ZOMBIE_DEATH_DURATION=ZOMBIE_BONES_AT+BONES_HOLD+FADE_DURATION;
export type ZombieDeathVariant='fall'|'severed';
export type ZombieCorpse={x:number;y:number;dir:number;kind:number;elapsed:number;variant?:ZombieDeathVariant};
type DeathClip={
  frameWidth:number;frameHeight:number;frameCount:number;columns:number;
  bodyHeight:number;displayHeight:number;durationsMs:number[];
  frameAnchorX:number[];frameGroundY:number[];
  frameRects?:[number,number,number,number][];
};

export function preloadZombieDeath(scene:Phaser.Scene) {
  for(const action of ['fall','decompose','severed-fall','severed-decompose']) {
    const path=new URL(`zombie-${action}/Zombie-${action}`,document.baseURI).href;
    scene.load.image(`zombie-${action}`,path+'-spritesheet.png');
    scene.load.json(`zombie-${action}-meta`,path+'.json');
  }
}

export class ZombieDeathAnimator {
  readonly fall?:DeathClip;
  readonly decompose?:DeathClip;
  readonly severedFall?:DeathClip;
  readonly severedDecompose?:DeathClip;
  constructor(readonly scene:Phaser.Scene) {
    this.fall=scene.cache.json.get('zombie-fall-meta') as DeathClip|undefined;
    this.decompose=scene.cache.json.get('zombie-decompose-meta') as DeathClip|undefined;
    this.severedFall=scene.cache.json.get('zombie-severed-fall-meta') as DeathClip|undefined;
    this.severedDecompose=scene.cache.json.get('zombie-severed-decompose-meta') as DeathClip|undefined;
    for(const [key,clip] of [['zombie-fall',this.fall],['zombie-decompose',this.decompose],['zombie-severed-fall',this.severedFall],['zombie-severed-decompose',this.severedDecompose]] as const) {
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
    const t=corpse.elapsed,p=Phaser.Math.Clamp(t/ZOMBIE_FALL_DURATION,0,1);
    const x=corpse.x+corpse.dir*12*(1-(1-p)**2),y=Phaser.Math.Linear(corpse.y,groundY,p);
    const dissolve=Phaser.Math.Clamp((t-ZOMBIE_FALL_DURATION-SETTLE_DURATION)/DECOMPOSE_DURATION,0,1);
    const alpha=1-Phaser.Math.Clamp((t-ZOMBIE_BONES_AT-BONES_HOLD)/FADE_DURATION,0,1);
    const stage=t<ZOMBIE_FALL_DURATION?'fall':t<ZOMBIE_FALL_DURATION+SETTLE_DURATION?'settle':t<ZOMBIE_BONES_AT?'decompose':t<ZOMBIE_BONES_AT+BONES_HOLD?'bones':'fade';
    body.setData('corpseStage',stage);next.setData('corpseStage',stage);
    next.setVisible(false);
    const severed=corpse.kind===0&&corpse.variant==='severed'&&this.severedFall&&this.severedDecompose&&this.scene.textures.exists('zombie-severed-fall')&&this.scene.textures.exists('zombie-severed-decompose');
    const fall=severed?this.severedFall:this.fall,decompose=severed?this.severedDecompose:this.decompose;
    const fallKey=severed?'zombie-severed-fall':'zombie-fall',decomposeKey=severed?'zombie-severed-decompose':'zombie-decompose';
    if(corpse.kind===0&&fall&&decompose&&this.scene.textures.exists(fallKey)&&this.scene.textures.exists(decomposeKey)) {
      if(t<ZOMBIE_FALL_DURATION) {
        const total=fall.durationsMs.reduce((a,b)=>a+b,0);
        let remaining=p*total,frame=0;
        while(frame<fall.frameCount-1&&remaining>=fall.durationsMs[frame])remaining-=fall.durationsMs[frame++];
        this.pose(body,fallKey,fall,frame,x,y,corpse.dir,1);
      }else if(t<ZOMBIE_FALL_DURATION+SETTLE_DURATION) {
        // Blend the two sheets at the grounded pose so decomposition starts smoothly.
        const mix=(t-ZOMBIE_FALL_DURATION)/SETTLE_DURATION;
        this.pose(body,fallKey,fall,fall.frameCount-1,x,groundY,corpse.dir,1-mix);
        this.pose(next,decomposeKey,decompose,0,x,groundY,corpse.dir,mix);
      }else {
        // Crossfade adjacent decomposition poses; the bones stay opaque until cleanup.
        const position=dissolve*(decompose.frameCount-1),frame=Math.floor(position),mix=position-frame;
        this.pose(body,decomposeKey,decompose,frame,x,groundY,corpse.dir,alpha*(1-mix));
        if(frame<decompose.frameCount-1)this.pose(next,decomposeKey,decompose,frame+1,x,groundY,corpse.dir,alpha*mix);
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
    if(decompose&&this.scene.textures.exists('zombie-decompose')) {
      const frame=decompose.frameCount-1,scale=height/480;
      const bonesX=x+corpse.dir*(495-decompose.frameAnchorX[frame])*scale;
      this.pose(next,'zombie-decompose',decompose,frame,bonesX,groundY,corpse.dir,alpha*dissolve,scale);
    }else body.setAlpha(alpha*(1-dissolve));
  }
}
