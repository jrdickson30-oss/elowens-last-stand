import Phaser from 'phaser';

type Point={x:number;y:number};
type Target={x:number;y?:number;hp:number};
type Trail=Point&{angle:number;age:number};
export type ShieldFlight<T>=Point&{
 dir:number;originX:number;returning:boolean;hits:Set<T>;
 age:number;releaseAt:number;released:boolean;angle:number;trail:Trail[];
};
type Hooks={x:number;range:number;hand:(face:number,catching:boolean)=>Point;released:()=>void;caught:(face:number)=>void};
type Impact=Point&{age:number;face:number};
export const SHIELD_OUT_SPEED=500,SHIELD_RETURN_SPEED=600;

export function preloadThrownShield(scene:Phaser.Scene){
 scene.load.image('elowen-thrown-shield',new URL('elowen-shield-throw/Elowen-thrown-shield.png?v=throw-1',document.baseURI).href);
}

function touches(a:Point,b:Point,target:Target){
 const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
 const x=target.x,y=(target.y??422)-44;
 const t=length?Phaser.Math.Clamp(((x-a.x)*dx+(y-a.y)*dy)/length,0,1):0;
 return Math.hypot(x-a.x-dx*t,y-a.y-dy*t)<35;
}

/** One physical shield: release from the hand, fly out, then home into the catch. */
export class ShieldThrow<T extends Target>{
 flight:ShieldFlight<T>|null=null;
 impacts:Impact[]=[];
 readonly image:Phaser.GameObjects.Image;
 readonly ghosts:Phaser.GameObjects.Image[];
 private readonly sparks:Phaser.GameObjects.Graphics;
 constructor(readonly scene:Phaser.Scene){
  scene.textures.get('elowen-thrown-shield').setFilter(Phaser.Textures.FilterMode.NEAREST);
  this.image=scene.add.image(0,0,'elowen-thrown-shield').setDepth(2.12).setVisible(false);
  this.ghosts=Array.from({length:3},()=>scene.add.image(0,0,'elowen-thrown-shield').setDepth(1.95).setVisible(false));
  this.sparks=scene.add.graphics().setDepth(2.2);
 }
 reset(){this.flight=null;this.impacts=[];this.image.setVisible(false);this.ghosts.forEach(image=>image.setVisible(false));this.sparks.clear();}
 cast(x:number,point:Point,face:number,releaseAt:number){
  this.flight={...point,dir:face,originX:x,returning:false,hits:new Set(),age:0,releaseAt,released:false,angle:0,trail:[]};
 }
 tick(dt:number,hooks:Hooks,targets:T[],hit:(target:T,face:number)=>void){
  this.impacts.forEach(impact=>impact.age+=dt);this.impacts=this.impacts.filter(impact=>impact.age<.24);
  const shield=this.flight;if(!shield)return;
  const previousAge=shield.age;shield.age+=dt;
  let movement=dt;
  if(!shield.released){
   const hand=hooks.hand(shield.dir,false);shield.x=hand.x;shield.y=hand.y;
   if(shield.age+1e-6<shield.releaseAt)return;
   shield.released=true;shield.originX=hooks.x;hooks.released();
   movement=Math.max(0,Math.min(dt,shield.age-shield.releaseAt));
  }
  shield.trail.forEach(point=>point.age+=dt);shield.trail=shield.trail.filter(point=>point.age<.12);
  const previous={x:shield.x,y:shield.y};
  shield.trail.push({...previous,angle:shield.angle,age:0});
  shield.angle=(shield.age-shield.releaseAt)*18*shield.dir;
  let caught=false,catchFace=shield.dir;
  if(!shield.returning){
   const limit=shield.dir>0?Math.min(1250,shield.originX+hooks.range):Math.max(320,shield.originX-hooks.range);
   const next=shield.x+shield.dir*SHIELD_OUT_SPEED*movement;
   shield.x=shield.dir>0?Math.min(next,limit):Math.max(next,limit);
   if((shield.x-limit)*shield.dir>=-1e-6)shield.returning=true;
  }else{
   catchFace=Math.sign(shield.x-hooks.x)||shield.dir;
   const hand=hooks.hand(catchFace,true),dx=hand.x-shield.x,dy=hand.y-shield.y,distance=Math.hypot(dx,dy);
   const step=SHIELD_RETURN_SPEED*movement;
   if(distance<=step+12){shield.x=hand.x;shield.y=hand.y;caught=true;}
   else{shield.x+=dx/distance*step;shield.y+=dy/distance*step;}
  }
  // The swept collision keeps the original radius and once-per-throw damage,
  // including enemies crossed by a longer frame or only encountered on return.
  if(movement>0||previousAge>=shield.releaseAt)for(const target of targets){
   if(target.hp<=0||shield.hits.has(target)||!touches(previous,shield,target))continue;
   shield.hits.add(target);hit(target,shield.dir);
   this.impacts.push({x:target.x,y:(target.y??422)-44,age:0,face:shield.dir});
  }
  if(caught){this.flight=null;hooks.caught(catchFace);}
 }
 render(){
  this.image.setVisible(false);this.ghosts.forEach(image=>image.setVisible(false));this.sparks.clear();
  const shield=this.flight;
  const draw=(image:Phaser.GameObjects.Image,point:Point,angle:number,alpha:number)=>{
   const source=image.frame,ratio=source.width/source.height;
   image.setPosition(point.x,point.y).setDisplaySize(40*ratio,40).setRotation(angle).setAlpha(alpha).setVisible(true);
  };
  if(shield?.released){
   draw(this.image,shield,shield.angle,1);
   for(let i=0;i<this.ghosts.length;i++){
    const sample=shield.trail[Math.max(0,shield.trail.length-2-i*2)];
    if(sample&&sample.age>0)draw(this.ghosts[i],sample,sample.angle,.1/(i+1));
   }
  }
  const g=this.sparks;
  for(const impact of this.impacts){
   const t=impact.age/.24,alpha=1-t;
   for(let i=0;i<7;i++){
    const angle=i*Math.PI*2/7,radius=4+26*t,x=impact.x+Math.cos(angle)*radius,y=impact.y+Math.sin(angle)*radius;
    g.lineStyle(i%2?1:2,i%2?0xd7caa4:0xfff3cf,alpha);
    g.lineBetween(x,y,x+Math.cos(angle)*7*(1-t),y+Math.sin(angle)*7*(1-t));
   }
  }
 }
}
