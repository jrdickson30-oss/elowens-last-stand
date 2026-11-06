import Phaser from 'phaser';

type Point={x:number;y:number};
export type IceShot=Point&{dir:number;life:number};
type Beam={shot:IceShot;origin:Point;age:number;fade:number|null};
type Impact=Point&{age:number;face:number};
export const ICE_CHARGE=.34;
export const ICE_SPLASH_RADIUS=105;
export const ICE_IMPACT_DURATION=.9;
export const ICE_MIST_DURATION=1.65;
const FADE=.16;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{n=clamp(n);return n*n*(3-2*n);};

/** The shield charges first; the advancing beam shares the actual damage shot. */
export class IceLance {
 pending:{face:number;delay:number}|null=null;
 beams:Beam[]=[];
 impacts:Impact[]=[];
 mistPool:Phaser.GameObjects.Image[]=[];
 cast(face:number,delay=ICE_CHARGE){this.pending={face,delay};}
 reset(){this.pending=null;this.beams=[];this.impacts=[];this.mistPool.forEach(image=>image.setVisible(false));}
 get active(){return !!this.pending||this.beams.length>0||this.impacts.length>0;}
 tick(dt:number,muzzle:(face:number)=>Point,release:(point:Point,face:number)=>IceShot){
  this.impacts.forEach(impact=>impact.age+=dt);
  this.impacts=this.impacts.filter(impact=>impact.age<ICE_MIST_DURATION);
  for(const beam of this.beams){
   beam.age+=dt;
   if(beam.shot.life>0)beam.origin=muzzle(beam.shot.dir);
   else beam.fade=(beam.fade??0)+dt;
  }
  this.beams=this.beams.filter(beam=>beam.fade===null||beam.fade<FADE);
  if(!this.pending)return;
  this.pending.delay-=dt;if(this.pending.delay>1e-6)return;
  const face=this.pending.face,origin=muzzle(face),shot=release(origin,face);
  this.beams.push({shot,origin,age:0,fade:null});this.pending=null;
 }
 impact(shot:IceShot){this.impacts.push({x:shot.x,y:shot.y,face:shot.dir,age:0});}
 private prepareMist(g:Phaser.GameObjects.Graphics){
  const scene=g.scene,key='ice-lance-frost-mist';
  if(scene.textures.exists(key))return;
  const texture=scene.textures.createCanvas(key,128,128)!,ctx=texture.context;
  const gradient=ctx.createRadialGradient(64,64,0,64,64,63);
  gradient.addColorStop(0,'rgba(228,251,255,.95)');
  gradient.addColorStop(.35,'rgba(196,235,250,.72)');
  gradient.addColorStop(.72,'rgba(136,204,234,.25)');
  gradient.addColorStop(1,'rgba(118,195,229,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  texture.refresh().setFilter(Phaser.Textures.FilterMode.LINEAR);
 }
 private mist(g:Phaser.GameObjects.Graphics,impact:Impact,index:number,floor:number){
  const t=clamp(impact.age/ICE_MIST_DURATION),growth=1-Math.exp(-impact.age*10);
  const birth=smooth(impact.age/.16),disperse=smooth((impact.age-.35)/1.3);
  for(let i=0;i<9;i++){
   // Each wisp eases to zero separately, with a flat slope at the end. The mist
   // can linger after the quick crystal burst without cutting off as a group.
   const life=i?1.29+(i%4)*.12:1.49;
   const envelope=birth*(1-smooth((impact.age-.24)/(life-.24)));
   const angle=(i-1)*Math.PI/4+impact.face*.1;
   const spread=i?ICE_SPLASH_RADIUS*.48*growth:0;
   const radius=ICE_SPLASH_RADIUS*(i?.25+.19*growth:.32+.20*growth)*(1+.1*disperse);
   let image=this.mistPool[index++];
   if(!image){image=g.scene.add.image(0,0,'ice-lance-frost-mist').setDepth(1.9);this.mistPool.push(image);}
   const y=impact.y+Math.sin(angle)*spread*.8-12*t,height=radius*1.75;
   // These upright puffs only need a rectangular floor crop. A geometry mask
   // overwrites sprite alpha in Phaser's Canvas path, preventing visible fades.
   const cropHeight=128*clamp((floor-y+height/2)/height);
   image.setPosition(impact.x+Math.cos(angle)*spread,y).setDisplaySize(radius*2,height)
    .setCrop(0,0,128,cropHeight).setAlpha(envelope*(i?.15:.22)).setVisible(envelope>0&&cropHeight>0);
  }
  return index;
 }
 render(g:Phaser.GameObjects.Graphics,floor=422){
  this.mistPool.forEach(image=>image.setVisible(false));let mistIndex=0;
  if(this.impacts.length)this.prepareMist(g);
  for(const beam of this.beams){
   const {shot,origin,age}=beam;
   const alpha=beam.fade===null?1:Math.max(0,1-beam.fade/FADE);
   const length=Math.max(0,(shot.x-origin.x)*shot.dir);
   if(length<1)continue;
   const segments=Math.max(2,Math.ceil(length/14));
   // Continuous tapered layers keep the beam readable without a strobing outline.
   for(const [width,color,opacity] of [[22,0x79cde9,.10],[13,0x70c9f2,.28],[7,0xb4eeff,.8],[3,0xf5ffff,1]]){
    for(let i=0;i<segments;i++){
     const u=i/segments,v=(i+1)/segments;
     const x1=origin.x+shot.dir*length*u,x2=origin.x+shot.dir*length*v;
     const wave=(t:number)=>Math.sin(t*13-age*17)*Math.sin(t*Math.PI)*1.5;
     g.lineStyle(width*(.65+.35*Math.sin((u+.1)*Math.PI*.8)),color,alpha*opacity);
     g.lineBetween(x1,origin.y+(shot.y-origin.y)*u+wave(u),x2,origin.y+(shot.y-origin.y)*v+wave(v));
    }
   }
   // Small icy facets ride outward along the stream, rather than random squares.
   for(let i=0;i<9;i++){
    const u=(i/9+age*1.6)%1,x=origin.x+shot.dir*length*u;
    const y=origin.y+(shot.y-origin.y)*u+Math.sin(i*2.4+age*7)*(5+i%3);
    const size=2+i%3;
    g.fillStyle(i%2?0xddf9ff:0x8acdeb,alpha*.75);
    g.fillTriangle(x-shot.dir*size*2,y-size,x+shot.dir*size,y,x-shot.dir*size*2,y+size);
   }
   const tip=4+Math.sin(age*9)*.5;
   g.fillStyle(0x90dff5,alpha*.55);
   g.fillTriangle(shot.x+shot.dir*8,shot.y,shot.x-shot.dir*10,shot.y-tip*1.6,shot.x-shot.dir*10,shot.y+tip*1.6);
   g.fillStyle(0xf4ffff,alpha);
   g.fillTriangle(shot.x+shot.dir*5,shot.y,shot.x-shot.dir*8,shot.y-tip*.65,shot.x-shot.dir*8,shot.y+tip*.65);
   g.fillStyle(0xdbf9ff,alpha*.75);g.fillEllipse(origin.x,origin.y,5,14);
  }
  for(const impact of this.impacts){
   const t=clamp(impact.age/ICE_IMPACT_DURATION),alpha=Math.pow(1-t,.8);
   const growth=1-Math.pow(1-clamp(impact.age/.24),3),radius=8+(ICE_SPLASH_RADIUS-8)*growth;
   mistIndex=this.mist(g,impact,mistIndex,floor);
   if(impact.age>=ICE_IMPACT_DURATION)continue;
   // A fast, broken frost front reveals the same radius used by splash damage.
   const waveAlpha=Math.exp(-impact.age*5.5);
   for(const [width,opacity,color] of [[8,.08,0x79d5ee],[2.5,.55,0xbdefff],[1,.8,0xf0ffff]]){
    g.lineStyle(width,color,waveAlpha*opacity);
    for(let i=0;i<48;i++){
     if(i%6===4)continue;
     const a=i*Math.PI/24,b=(i+1)*Math.PI/24;
     const x1=impact.x+Math.cos(a)*radius,y1=impact.y+Math.sin(a)*radius;
     const x2=impact.x+Math.cos(b)*radius,y2=impact.y+Math.sin(b)*radius;
     if(y1<=floor&&y2<=floor)g.lineBetween(x1,y1,x2,y2);
    }
   }
   // A brief central flash gives way to cold vapour instead of a lingering orb.
   const flash=1-clamp(impact.age/.14);
   if(flash>0){g.fillStyle(0xe4fbff,flash*.7);g.fillCircle(impact.x,impact.y,8+15*(1-flash));}
   if(Math.abs(floor-impact.y)<ICE_SPLASH_RADIUS){
    const groundRadius=Math.sqrt(ICE_SPLASH_RADIUS**2-(floor-impact.y)**2)*growth;
    g.fillStyle(0xafdcf1,alpha*.10);g.fillEllipse(impact.x,floor-5,groundRadius*2,10);
   }
   // Deterministic drag/gravity keep crystal trajectories smooth at any frame rate.
   const flight=(1-Math.exp(-4*impact.age))/4;
   for(let i=0;i<18;i++){
    const angle=i*Math.PI/9+.13*Math.sin(i*2.6),speed=330+i%4*20;
    const vx=Math.cos(angle)*speed*impact.face,vy=Math.sin(angle)*speed*.8-20;
    const x=impact.x+vx*flight,y=Math.min(floor-5,impact.y+vy*flight+70*impact.age**2);
    const spin=angle+(i%2?1:-1)*impact.age*(2+i%3);
    const size=(8+i%4*2)*(1-t*.35),width=3+i%3;
    const dx=Math.cos(spin),dy=Math.sin(spin),nx=-dy,ny=dx;
    const tip={x:x+dx*size,y:y+dy*size},tail={x:x-dx*size*.75,y:y-dy*size*.75};
    const left={x:x+nx*width,y:y+ny*width},right={x:x-nx*width,y:y-ny*width};
    if(tip.y>floor||tail.y>floor||left.y>floor||right.y>floor)continue;
    g.fillStyle(0x82c4e2,alpha);g.fillTriangle(tip.x,tip.y,left.x,left.y,tail.x,tail.y);
    g.fillStyle(0xd9f7ff,alpha);g.fillTriangle(tip.x,tip.y,tail.x,tail.y,right.x,right.y);
    g.fillStyle(0xf5ffff,alpha*.9);g.fillTriangle(tip.x,tip.y,x,y,left.x,left.y);
   }
   for(let i=0;i<20;i++){
    const a=i*Math.PI/10+.17,r=(12+(ICE_SPLASH_RADIUS-18)*growth)*(i%3===0?.7:1);
    const x=impact.x+Math.cos(a)*r,y=impact.y+Math.sin(a)*r-6*t;
    if(y>floor-2)continue;
    g.fillStyle(i%2?0xe7fbff:0x98d6ee,alpha*.8);g.fillRect(x,y,1+i%2,1+i%2);
   }
  }
 }
}
