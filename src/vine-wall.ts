import Phaser from 'phaser';

export type VineBarrier={x:number;hp:number;max:number};
type LeafFragment={x:number;y:number;vx:number;vy:number;age:number;life:number;size:number;seed:number};
type Hit={age:number;side:number};
export const VINE_GROW_TIME=2.8;
export const VINE_COLLAPSE_TIME=.8;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>1-Math.pow(1-clamp(n),3);
const tints={worn:0xd2d4ae,wilt:0xb2a47b,dead:0x9c8c65};

type VineClip={frameWidth:number;frameHeight:number;frameCount:number;columns:number;displayHeight:number;bodyHeight:number;frameGroundY:number[];frameTopY:number[];frameAnchorX:number[];frameRects:[number,number,number,number][]};
export function preloadVineWall(scene:Phaser.Scene){
  const path=new URL('wall-of-vines/Wall-of-vines-growth-24',document.baseURI).href;
  scene.load.image('vine-wall',path+'-spritesheet.png');
  scene.load.json('vine-wall-meta',path+'.json');
}

/** The barrier's roots, stems and leaves animate independently of its collision. */
export class VineWall {
  barrier:VineBarrier|null=null;
  elapsed=0;
  collapse:number|null=null;
  hits:Hit[]=[];
  fragments:LeafFragment[]=[];
  private sequence=0;
  readonly body:Phaser.GameObjects.Image;
  readonly next:Phaser.GameObjects.Image;
  readonly clip:VineClip;
  private readonly canvasTint:boolean;
  constructor(scene:Phaser.Scene){
    this.clip=scene.cache.json.get('vine-wall-meta') as VineClip;
    const texture=scene.textures.get('vine-wall');
    for(let frame=0;frame<this.clip.frameCount;frame++)texture.add(frame,0,...this.clip.frameRects[frame]);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.canvasTint=scene.game.renderer.type===Phaser.CANVAS;
    // Canvas sprites lack WebGL's tint shader. Cache the same colour treatment
    // once so fallback graphics keep the wall's damage and withering feedback.
    if(this.canvasTint){
      const source=texture.getSourceImage() as HTMLImageElement;
      for(const [stage,colour] of Object.entries(tints)){
        const tinted=scene.textures.createCanvas(`vine-wall-${stage}`,source.width,source.height)!,ctx=tinted.context;
        ctx.drawImage(source,0,0);ctx.globalCompositeOperation='multiply';ctx.fillStyle=`#${colour.toString(16).padStart(6,'0')}`;ctx.fillRect(0,0,source.width,source.height);
        ctx.globalCompositeOperation='destination-in';ctx.drawImage(source,0,0);ctx.globalCompositeOperation='source-over';tinted.refresh();
        for(let frame=0;frame<this.clip.frameCount;frame++)tinted.add(frame,0,...this.clip.frameRects[frame]);
        tinted.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    this.body=scene.add.image(0,0,'vine-wall',0).setDepth(1.65).setVisible(false);
    this.next=scene.add.image(0,0,'vine-wall',0).setDepth(1.66).setVisible(false);
  }
  summon(barrier:VineBarrier){
    this.reset();this.barrier=barrier;
    for(let i=0;i<12;i++)this.fragments.push({x:barrier.x+(i%5-2)*9,y:421,vx:(i%2?1:-1)*(14+i*4),vy:-35-i*5,age:0,life:.45+i*.015,size:2,seed:i});
  }
  reset(){this.barrier=null;this.elapsed=0;this.collapse=null;this.hits=[];this.fragments=[];this.sequence=0;this.body.setVisible(false);this.next.setVisible(false);}
  private height(){
    const position=clamp(this.elapsed/VINE_GROW_TIME)*(this.clip.frameCount-1),f=Math.floor(position),next=Math.min(this.clip.frameCount-1,f+1),mix=position-f;
    const height=(i:number)=>this.clip.frameGroundY[i]-this.clip.frameTopY[i];
    return (height(f)*(1-mix)+height(next)*mix)*this.clip.displayHeight/this.clip.bodyHeight;
  }
  strike(side:number){
    this.hits.push({age:0,side});
    if(!this.barrier)return;
    for(let i=0;i<6;i++) {
      const seed=this.sequence++;
      this.fragments.push({x:this.barrier.x+side*17,y:422-this.height()*(.3+seed%5*.12),vx:-side*(22+seed%4*12),vy:-45-seed%3*16,age:0,life:.55+seed%4*.06,size:3+seed%3,seed});
    }
  }
  destroy(){
    if(!this.barrier||this.collapse!==null)return;
    this.collapse=0;
    for(let i=0;i<20;i++)this.fragments.push({x:this.barrier.x+(i%5-2)*10,y:422-this.height()*(.15+i%7*.12),vx:(i%2?1:-1)*(15+i*3),vy:-20-i%5*12,age:0,life:.6+i%4*.08,size:3+i%3,seed:i});
  }
  tick(dt:number,barrier:VineBarrier|null){
    if(barrier&&barrier!==this.barrier)this.summon(barrier);
    if(!barrier&&this.barrier)this.destroy();
    this.elapsed+=dt;
    this.hits.forEach(h=>h.age+=dt);this.hits=this.hits.filter(h=>h.age<.32);
    if(this.collapse!==null){this.collapse+=dt;if(this.collapse>=VINE_COLLAPSE_TIME)this.barrier=null;}
    for(const p of this.fragments){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=230*dt;}
    this.fragments=this.fragments.filter(p=>p.age<p.life);
    if(!this.barrier&&!this.fragments.length){this.collapse=null;this.hits=[];}
  }
  render(g:Phaser.GameObjects.Graphics,ground:number){
    this.body.setVisible(false);this.next.setVisible(false);
    const b=this.barrier;
    if(b) {
      const dead=this.collapse===null?0:clamp(this.collapse/VINE_COLLAPSE_TIME);
      const health=clamp(b.hp/b.max),growth=clamp(this.elapsed/VINE_GROW_TIME);
      const position=growth*(this.clip.frameCount-1),frame=Math.floor(position),blend=position-frame;
      const mix=blend,alpha=1-dead;
      const bend=this.hits.reduce((sum,h)=>sum-h.side*Math.sin(h.age/.32*Math.PI*2)*2*(1-h.age/.32),0);
      const angle=Math.sin(this.elapsed*1.35)*.18*growth+bend+dead*18;
      const scale=this.clip.displayHeight/this.clip.bodyHeight;
      const stage=dead>0?'dead':health<.35?'wilt':health<.65?'worn':null;
      const tint=stage?tints[stage]:0xffffff,key=this.canvasTint&&stage?`vine-wall-${stage}`:'vine-wall';
      const pose=(image:Phaser.GameObjects.Image,f:number,opacity:number)=>image.setTexture(key,f)
        .setOrigin(this.clip.frameAnchorX[f]/image.frame.width,this.clip.frameGroundY[f]/image.frame.height)
        .setPosition(b.x,ground+dead*17).setScale(scale*(1-dead*.16)).setAngle(angle).setTint(tint)
        .setAlpha(opacity).setVisible(opacity>0).setData('vineStage',f);
      // Fixed-scale growth artwork curls upward; adjacent stages blend without stretching.
      pose(this.body,frame,alpha*(1-mix));
      if(frame<this.clip.frameCount-1)pose(this.next,frame+1,alpha*mix);
      g.fillStyle(0x061b12,.28*alpha);g.fillEllipse(b.x,ground+2,90,10);
      if(this.elapsed<.85){g.lineStyle(1,0xa9bd70,(1-this.elapsed/.85)*.4);g.strokeEllipse(b.x,ground+1,35+48*ease(this.elapsed/.85),8);}
      if(this.elapsed>.2&&dead===0) {
        g.fillStyle(0x132a21,.9);g.fillRect(b.x-26,ground-this.height()-10,52,5);
        g.fillStyle(health<.35?0xb0a15b:0x9cb86a);g.fillRect(b.x-25,ground-this.height()-9,50*health,3);
      }
    }
    for(const p of this.fragments) {
      const alpha=1-p.age/p.life;
      if(p.size===2){g.fillStyle(0x8d7951,alpha);g.fillRect(p.x,p.y,3,2);}
      else leaf(g,p.x,Math.min(ground+3,p.y),p.seed%2?1:-1,p.size*1.8,Math.sin(p.age*10+p.seed)*5,p.seed%2?0x91ab55:0x607f35,alpha);
    }
  }
}

function leaf(g:Phaser.GameObjects.Graphics,x:number,y:number,side:number,length:number,lift:number,colour:number,alpha:number){
  if(length<.5)return;
  const tip={x:x+side*length,y:y+lift};
  g.fillStyle(colour,alpha);g.lineStyle(1,0x294829,alpha*.7);
  g.beginPath();g.moveTo(x,y);g.lineTo(x+side*length*.45,y+lift*.5-4);g.lineTo(tip.x,tip.y);g.lineTo(x+side*length*.55,y+lift*.5+3);g.closePath();g.fillPath();g.strokePath();
  g.lineStyle(1,0xc0cd80,alpha*.5);g.lineBetween(x,y,tip.x,tip.y);
}
