import Phaser from 'phaser';

type Target={x:number;y?:number;hp:number};
type Wave<T>={x:number;floor:number;face:number;targets:T[];hits:Set<T>};
type Rock<T>={x:number;floor:number;face:number;index:number;age:number;duration:number;size:number;wave:Wave<T>};
type Dust={x:number;y:number;floor:number;vx:number;vy:number;age:number;life:number;seed:number;face:number};
export const STONE_LIFT_DELAY=.24;
export const STONE_WAVE_TIME=.82;
export const STONE_SPEED_MULTIPLIER=1.5;
export const STONE_LAUNCH_ANGLE=Math.PI/6;
const DUST_STEP=.04/STONE_SPEED_MULTIPLIER;
const FADE=.14;
const clamp=(t:number)=>Math.max(0,Math.min(1,t));
const smooth=(t:number)=>{t=clamp(t);return t*t*(3-2*t);};

export function preloadStoneshardBarrage(scene:Phaser.Scene){
  scene.load.spritesheet('stoneshard-rocks',new URL('stoneshard-barrage/Stoneshard-rocks-wave-spritesheet.png',document.baseURI).href,
    {frameWidth:128,frameHeight:128,endFrame:7});
}

function touches(a:{x:number;y:number},b:{x:number;y:number},target:Target,floor:number,radius:number){
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  return [20,50,80].some(height=>{
    const x=target.x,y=(target.y??floor)-height;
    const t=length?clamp(((x-a.x)*dx+(y-a.y)*dy)/length):0;
    return Math.hypot(x-a.x-dx*t,y-a.y-dy*t)<=radius;
  });
}

/** Six fragments stream out of the floor along parallel 30-degree launch paths. */
export class StoneshardBarrage<T extends Target> {
  rocks:Rock<T>[]=[];
  pool:Phaser.GameObjects.Image[]=[];
  dust:Dust[]=[];
  grit:Dust[]=[];
  dustPool:Phaser.GameObjects.Image[]=[];
  private gritLayer:Phaser.GameObjects.Graphics;
  private ground:Phaser.GameObjects.Graphics;
  private mask:Phaser.Display.Masks.GeometryMask;
  constructor(readonly scene:Phaser.Scene){
    scene.textures.get('stoneshard-rocks').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.ground=scene.add.graphics().setVisible(false);this.mask=this.ground.createGeometryMask();
    this.gritLayer=scene.add.graphics().setDepth(.92).setMask(this.mask);
    // A soft runtime particle texture is shared by the entire wake.
    for(const [index,rgb] of [[0,'174,151,118'],[1,'148,132,111']] as const){
      const key=`stoneshard-dust-${index}`;
      if(scene.textures.exists(key))continue;
      const texture=scene.textures.createCanvas(key,96,96)!,ctx=texture.context;
      const gradient=ctx.createRadialGradient(48,48,3,48,48,46);
      gradient.addColorStop(0,`rgba(${rgb},.85)`);gradient.addColorStop(.35,`rgba(${rgb},.65)`);
      gradient.addColorStop(.7,`rgba(${rgb},.22)`);gradient.addColorStop(1,`rgba(${rgb},0)`);
      ctx.fillStyle=gradient;ctx.fillRect(0,0,96,96);texture.refresh().setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
  get active(){return this.rocks.length>0||this.dust.length>0||this.grit.length>0;}
  reset(){this.rocks=[];this.dust=[];this.grit=[];this.gritLayer.clear();for(const image of [...this.pool,...this.dustPool])image.setVisible(false);}
  cast(x:number,floor:number,face:number,targets:T[]){
    const wave:Wave<T>={x,floor,face,targets:[...targets],hits:new Set()};
    this.ground.clear().fillStyle(0xffffff).fillRect(-4096,-4096,8192,4096+floor);
    for(let i=0;i<6;i++)this.rocks.push({x:x+face*(26+i*10),floor,face,index:i,age:-STONE_LIFT_DELAY-i*.032,duration:(STONE_WAVE_TIME+i*.012)/STONE_SPEED_MULTIPLIER,size:18+i%3*3,wave});
  }
  tick(dt:number,hit:(target:T,face:number)=>void){
    for(const particle of [...this.dust,...this.grit])particle.age+=dt;
    this.dust=this.dust.filter(p=>p.age<p.life);this.grit=this.grit.filter(p=>p.age<p.life);
    for(const rock of this.rocks){
      const previous=rock.age;rock.age+=dt;
      const from=Math.max(0,previous),to=Math.min(rock.duration,rock.age);
      if(to<=from)continue;
      // Keep the same density along the path when rock speed or frame rate changes.
      for(let n=Math.floor(from/DUST_STEP)+1;n<=Math.floor(Math.min(to,rock.duration*.92)/DUST_STEP);n++){
        const at=n*DUST_STEP,p=this.position(rock,at),seed=(n*17+rock.index*23)%97,age=rock.age-at;
        if(p.y>rock.floor+8)continue;
        if(rock.index%2===0){
          const dust:Dust={x:p.x-rock.face*5,y:p.y+(seed%7-3),floor:rock.floor,vx:-rock.face*(10+seed%13),vy:-5-seed%8,age,life:.58+(seed%5)*.035,seed,face:rock.face};
          if(age<dust.life)this.dust.push(dust);
        }
        if(n%2===0){
          const grit:Dust={x:p.x-rock.face*3,y:p.y,floor:rock.floor,vx:-rock.face*(14+seed%20),vy:-20-seed%26,age,life:.30+(seed%4)*.035,seed,face:rock.face};
          if(age<grit.life)this.grit.push(grit);
        }
      }
      // Sweep the path in small intervals, including long/slow frames.
      const steps=Math.max(1,Math.ceil((to-from)*60));let a=this.position(rock,from);
      for(let i=1;i<=steps;i++){
        const b=this.position(rock,from+(to-from)*i/steps);
        if(b.y<rock.floor-8)for(const target of rock.wave.targets){
          if(target.hp>0&&!rock.wave.hits.has(target)&&touches(a,b,target,rock.floor,18+rock.size*.3)){
            rock.wave.hits.add(target);hit(target,rock.face);
          }
        }
        a=b;
      }
    }
    this.rocks=this.rocks.filter(rock=>rock.age<rock.duration+FADE);
  }
  position(rock:Rock<T>,age=rock.age){
    const u=clamp(age/rock.duration),t=.5-.5*Math.cos(u*Math.PI);
    const startX=rock.x,startY=rock.floor+rock.size*.45;
    const endX=rock.wave.x+rock.face*(190-rock.index%3*5),travel=(endX-startX)*t;
    // Easing changes speed only; the launch direction stays exactly 30 degrees up.
    return {
      x:startX+travel,
      y:startY-Math.abs(travel)*Math.tan(STONE_LAUNCH_ANGLE),
      scale:1,
      alpha:smooth(age/.10)*(1-smooth((age-rock.duration)/FADE)),
      angle:rock.face*((rock.index%3-1)*9+Math.sin(t*Math.PI)*11)
    };
  }
  private renderDust(){
    this.dustPool.forEach(image=>image.setVisible(false));let index=0;
    for(const p of this.dust){
      const t=clamp(p.age/p.life),fade=smooth(p.age/.07)*(1-smooth((t-.35)/.65));
      const radius=6+p.seed%4+(13+p.seed%5)*smooth(t);
      // Fill from the road up to the passing rocks. Cropping the lower fifth of
      // each plume at the floor keeps a visible ground contact as it expands.
      const ceiling=Math.min(p.floor-8,p.y+p.vy*p.age-radius);
      const height=(p.floor+1-ceiling)/.8;
      let image=this.dustPool[index++];
      if(!image){image=this.scene.add.image(0,0,'stoneshard-dust-0').setDepth(.90).setMask(this.mask);this.dustPool.push(image);}
      image.setTexture(`stoneshard-dust-${p.seed%2}`).setOrigin(.5,.8).setPosition(p.x+p.vx*p.age,p.floor+1)
        .setScale(radius/48*1.25,height/96).setAngle(0).setAlpha(fade*.24).setVisible(fade>0)
        .setData('dustFloor',p.floor).setData('dustTop',ceiling);
    }
    this.gritLayer.clear();
    for(const p of this.grit){
      const fade=smooth(p.age/.035)*(1-smooth(p.age/p.life));
      const x=p.x+p.vx*p.age,y=p.y+p.vy*p.age+65*p.age*p.age;
      this.gritLayer.fillStyle(p.seed%2?0xc3ad8a:0x7e6c54,fade*.7);this.gritLayer.fillRect(x,y,1+p.seed%2,1+p.seed%2);
    }
  }
  render(g:Phaser.GameObjects.Graphics){
    this.renderDust();
    this.pool.forEach(image=>image.setVisible(false));let index=0;
    for(const rock of this.rocks){
      const a=rock.age;
      if(a>=-.07&&a<.34){
        const fade=smooth((a+.07)/.12)*(1-smooth((a-.12)/.22));
        g.fillStyle(0x9b876d,fade*.12);g.fillEllipse(rock.x,rock.floor-1,10+clamp(a/.3)*14,5);
        g.lineStyle(1,0x5c4a38,fade*.35);g.lineBetween(rock.x-7,rock.floor,rock.x+9,rock.floor);
      }
      if(a<0)continue;
      const p=this.position(rock);
      if(a>0&&a<rock.duration)for(let i=1;i<5;i++){
        const tail=this.position(rock,Math.max(0,a-i*.018)),next=this.position(rock,Math.max(0,a-(i-1)*.018));
        g.lineStyle(2,0xae9878,p.alpha*(1-i/5)*.10);g.lineBetween(tail.x,Math.min(rock.floor,tail.y),next.x,Math.min(rock.floor,next.y));
      }
      let image=this.pool[index++];if(!image){image=this.scene.add.image(0,0,'stoneshard-rocks').setDepth(2.15).setMask(this.mask);this.pool.push(image);}
      image.setTexture('stoneshard-rocks',rock.index%8).setPosition(p.x,p.y).setOrigin(.5).setFlipX(rock.face<0)
        .setScale(rock.size/96).setAngle(p.angle).setAlpha(p.alpha).setVisible(p.alpha>0)
        .setData('stonePhase',a/rock.duration<.35?'lift':'flight');
    }
  }
}
