import type Phaser from 'phaser';

type Target = {x:number;y?:number;hp:number};
type Point = {x:number;y:number};
type Star<T> = Point & {target:T;origin:Point;age:number;flight:number;face:number;index:number;trail:Point[]};
type Impact = Point & {age:number};
const BIRTH = .18;

/** Four stars condense overhead, then bend toward their assigned moving targets. */
export class RadiantVolley<T extends Target> {
  stars:Star<T>[]=[];
  impacts:Impact[]=[];
  cast(targets:T[],face:number) {
    if(!targets.length)return;
    for(let i=0;i<4;i++) {
      const target=targets[i%Math.min(4,targets.length)];
      const origin={x:Math.max(330,Math.min(1230,target.x-face*(105+i*19))),y:125+(i%2)*26};
      this.stars.push({...origin,origin,target,face,index:i,age:-.12-i*.09,flight:.52+i*.025,trail:[]});
    }
  }
  reset(){this.stars=[];this.impacts=[];}
  get active(){return this.stars.length>0;}
  tick(dt:number,hit:(target:T,face:number)=>void) {
    this.impacts.forEach(p=>p.age+=dt);
    this.impacts=this.impacts.filter(p=>p.age<.28);
    for(const s of this.stars) {
      s.age+=dt;
      if(s.age<BIRTH)continue;
      const t=Math.min(1,(s.age-BIRTH)/s.flight),u=1-t;
      const end={x:s.target.x,y:(s.target.y??422)-76};
      // Re-evaluate the endpoint every frame so a running target remains tracked.
      const bend=s.face*(65+s.index*10);
      s.x=u*u*u*s.origin.x+3*u*u*t*(s.origin.x+bend)+3*u*t*t*(end.x-s.face*35)+t*t*t*end.x;
      s.y=u*u*u*s.origin.y+3*u*u*t*(s.origin.y+25)+3*u*t*t*(end.y-110)+t*t*t*end.y;
      s.trail.push({x:s.x,y:s.y});
      if(s.trail.length>13)s.trail.shift();
      if(t>=1) {
        this.impacts.push({x:s.x,y:s.y,age:0});
        if(s.target.hp>0)hit(s.target,s.face);
      }
    }
    this.stars=this.stars.filter(s=>s.age<BIRTH+s.flight);
  }
  render(g:Phaser.GameObjects.Graphics) {
    for(const s of this.stars) {
      if(s.age<0)continue;
      if(s.age<BIRTH) {
        const t=s.age/BIRTH;
        g.lineStyle(1,0xbcdfff,(1-t)*.7);g.strokeCircle(s.x,s.y,24*(1-t)+5);
        for(let i=0;i<5;i++) {
          const a=i*Math.PI*2/5+s.age*3,r=28*(1-t)+4;
          g.fillStyle(0xffe8ad,t);g.fillRect(s.x+Math.cos(a)*r-1,s.y+Math.sin(a)*r-1,2,2);
        }
        star(g,s.x,s.y,3+9*t,t);
        continue;
      }
      for(let i=1;i<s.trail.length;i++) {
        const a=s.trail[i-1],b=s.trail[i],t=i/s.trail.length;
        g.lineStyle(11*t,0x97cfff,.12*t);g.lineBetween(a.x,a.y,b.x,b.y);
        g.lineStyle(5*t,0xf4d284,.65*t);g.lineBetween(a.x,a.y,b.x,b.y);
        g.lineStyle(2*t,0xffffff,.9*t);g.lineBetween(a.x,a.y,b.x,b.y);
        if(i%3===0){g.fillStyle(0xfff2c2,.65*t);g.fillRect(a.x+(i%2?6:-6),a.y-2,2,2);}
      }
      star(g,s.x,s.y,11+Math.sin(s.age*25)*1.3,1);
    }
    for(const p of this.impacts) {
      const t=p.age/.28;
      g.lineStyle(2,0xffe7a0,(1-t)*.85);g.strokeCircle(p.x,p.y,5+26*t);
      star(g,p.x,p.y,22*(1-t)+2,1-t);
      for(let i=0;i<7;i++) {
        const a=i*Math.PI*2/7,r=12+30*t;
        g.lineStyle(2,0xfff4cf,1-t);g.lineBetween(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,p.x+Math.cos(a)*(r+5),p.y+Math.sin(a)*(r+5));
      }
    }
  }
}

function star(g:Phaser.GameObjects.Graphics,x:number,y:number,r:number,alpha:number) {
  g.fillStyle(0x9dd7ff,alpha*.12);g.fillCircle(x,y,r*1.9);
  g.fillStyle(0xf6d78d,alpha*.2);g.fillCircle(x,y,r*1.25);
  g.fillStyle(0xffe8a3,alpha);
  g.beginPath();
  for(let i=0;i<16;i++) {
    const a=i*Math.PI/8-Math.PI/2,length=i%2?r*.22:i%4?r*.65:r;
    const px=x+Math.cos(a)*length,py=y+Math.sin(a)*length;
    if(i===0)g.moveTo(px,py);else g.lineTo(px,py);
  }
  g.closePath();g.fillPath();
  g.fillStyle(0xffffff,alpha);g.fillCircle(x,y,r*.28);
  g.fillTriangle(x,y-r*.8,x-r*.18,y,x+r*.18,y);
  g.fillTriangle(x,y+r*.8,x-r*.18,y,x+r*.18,y);
}
