import type Phaser from 'phaser';

export type VineBarrier={x:number;hp:number;max:number};
type LeafFragment={x:number;y:number;vx:number;vy:number;age:number;life:number;size:number;seed:number};
type Hit={age:number;side:number};
export const VINE_GROW_TIME=.65;
export const VINE_COLLAPSE_TIME=.6;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>1-Math.pow(1-clamp(n),3);

/** The barrier's roots, stems and leaves animate independently of its collision. */
export class VineWall {
  barrier:VineBarrier|null=null;
  elapsed=0;
  collapse:number|null=null;
  hits:Hit[]=[];
  fragments:LeafFragment[]=[];
  private sequence=0;
  summon(barrier:VineBarrier){
    this.reset();this.barrier=barrier;
    for(let i=0;i<12;i++)this.fragments.push({x:barrier.x+(i%5-2)*9,y:421,vx:(i%2?1:-1)*(14+i*4),vy:-35-i*5,age:0,life:.45+i*.015,size:2,seed:i});
  }
  reset(){this.barrier=null;this.elapsed=0;this.collapse=null;this.hits=[];this.fragments=[];this.sequence=0;}
  strike(side:number){
    this.hits.push({age:0,side});
    if(!this.barrier)return;
    for(let i=0;i<6;i++) {
      const seed=this.sequence++;
      this.fragments.push({x:this.barrier.x+side*17,y:343+(seed%5)*12,vx:-side*(22+seed%4*12),vy:-45-seed%3*16,age:0,life:.55+seed%4*.06,size:3+seed%3,seed});
    }
  }
  destroy(){
    if(!this.barrier||this.collapse!==null)return;
    this.collapse=0;
    for(let i=0;i<20;i++)this.fragments.push({x:this.barrier.x+(i%5-2)*10,y:310+(i%7)*15,vx:(i%2?1:-1)*(15+i*3),vy:-20-i%5*12,age:0,life:.6+i%4*.08,size:3+i%3,seed:i});
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
    const b=this.barrier;
    if(b) {
      const dead=this.collapse===null?0:clamp(this.collapse/VINE_COLLAPSE_TIME);
      const alpha=1-dead,health=clamp(b.hp/b.max),growth=ease(this.elapsed/VINE_GROW_TIME);
      const bend=this.hits.reduce((sum,h)=>sum-h.side*Math.sin(h.age/.32*Math.PI*3)*9*(1-h.age/.32),0);
      g.fillStyle(0x061b12,.4*alpha);g.fillEllipse(b.x,ground+2,73*growth,12);
      if(this.elapsed<.75){g.lineStyle(2,0xb5cf75,(1-this.elapsed/.75)*.65);g.strokeEllipse(b.x,ground+1,24+75*growth,6+12*growth);}
      // Roots crawl out along the paving before the thorn stems climb.
      for(let root=0;root<8;root++) {
        const side=root%2?1:-1,length=(22+root*2)*ease(this.elapsed/.26);
        const points=Array.from({length:9},(_,i)=>({x:b.x+side*length*i/8,y:ground-2+Math.sin(i*.8+root)*2}));
        stroke(g,points,4,dead?0x51402b:0x3b4526,alpha);
        stroke(g,points,1,dead?0x897347:0x8b9d51,alpha*.8);
      }
      for(let stem=0;stem<7;stem++) {
        const grow=ease((this.elapsed-stem*.036)/(.43+stem*.015));
        const height=112+(stem%3)*8,points=[];
        const point=(t:number)=>({
          x:b.x+(stem-3)*6+Math.sin(t*8+stem*1.7)*(5+t*5)+Math.sin(this.elapsed*1.8+stem)*t*t*2+bend*t*t+Math.sin(stem*2+1)*dead*t*t*47,
          y:ground-t*height*grow*(1-dead*.94)+Math.sin(t*9+stem)*dead*3
        });
        for(let i=0;i<=20;i++)points.push(point(i/20));
        const bark=dead?0x645235:health<.35?0x536038:0x426334;
        stroke(g,points,stem%2?6:8,0x172e21,alpha);
        stroke(g,points,stem%2?4:6,bark,alpha);
        stroke(g,points.map(p=>({x:p.x-1,y:p.y})),1.3,dead?0x9d8652:0x94ad60,alpha*.85);
        for(let node=1;node<=6;node++) {
          const t=node/7,p=point(t),side=(node+stem)%2?1:-1;
          if(grow<t*.8)continue;
          g.fillStyle(dead?0x8a7145:0xc5bc79,alpha);g.fillTriangle(p.x,p.y-3,p.x+side*7,p.y-6,p.x+side*2,p.y+2);
          // Damage sheds foliage, exposing the woody knotwork underneath.
          if((stem*3+node)%7/7>health+.18)continue;
          const leafGrow=ease((grow-t*.65)/.25),flutter=Math.sin(this.elapsed*2.7+stem+node)*2;
          leaf(g,p.x,p.y,side,(10+(node%3)*3)*leafGrow,p.y-ground< -70?-9:-5+flutter,dead?0x8a7341:node%2?0x6c9c46:0x91b65b,alpha);
        }
        // A curled growing tip makes the top edge read as living tendrils.
        if(grow>.3) {
          const tip=point(1),curl=[];
          for(let i=0;i<15;i++){const t=i/14,a=t*Math.PI*2.15,r=6*(1-t)*grow;curl.push({x:tip.x+Math.cos(a)*r,y:tip.y-Math.sin(a)*r});}
          stroke(g,curl,2,dead?0x947d48:0xa2ba6c,alpha);
        }
      }
      if(this.elapsed>.2&&dead===0) {
        g.fillStyle(0x132a21,.9);g.fillRect(b.x-26,ground-139,52,5);
        g.fillStyle(health<.35?0xb0a15b:0x9cb86a);g.fillRect(b.x-25,ground-138,50*health,3);
      }
    }
    for(const p of this.fragments) {
      const alpha=1-p.age/p.life;
      if(p.size===2){g.fillStyle(0x8d7951,alpha);g.fillRect(p.x,p.y,3,2);}
      else leaf(g,p.x,Math.min(ground+3,p.y),p.seed%2?1:-1,p.size*1.8,Math.sin(p.age*10+p.seed)*5,p.seed%2?0x91ab55:0x607f35,alpha);
    }
  }
}

function stroke(g:Phaser.GameObjects.Graphics,points:{x:number;y:number}[],width:number,colour:number,alpha:number){
  g.lineStyle(width,colour,alpha);g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.strokePath();
}
function leaf(g:Phaser.GameObjects.Graphics,x:number,y:number,side:number,length:number,lift:number,colour:number,alpha:number){
  if(length<.5)return;
  const tip={x:x+side*length,y:y+lift};
  g.fillStyle(colour,alpha);g.lineStyle(1,0x294829,alpha*.7);
  g.beginPath();g.moveTo(x,y);g.lineTo(x+side*length*.45,y+lift*.5-4);g.lineTo(tip.x,tip.y);g.lineTo(x+side*length*.55,y+lift*.5+3);g.closePath();g.fillPath();g.strokePath();
  g.lineStyle(1,0xc0cd80,alpha*.5);g.lineBetween(x,y,tip.x,tip.y);
}
