import Phaser from 'phaser';

type Target={x:number;y?:number;hp:number};
type Rock<T>={x:number;floor:number;face:number;index:number;age:number;target?:T;resolved:boolean;hits:Set<T>};
export const STONE_LIFT_DELAY=.24;
export const STONE_LIFT_TIME=.16;
export const STONE_FLIGHT_TIME=.28;
const IMPACT=STONE_LIFT_TIME+STONE_FLIGHT_TIME;
const ease=(t:number)=>1-Math.pow(1-Math.max(0,Math.min(1,t)),3);

export function preloadStoneshardBarrage(scene:Phaser.Scene){
  scene.load.spritesheet('stoneshard-rocks',new URL('stoneshard-barrage/Stoneshard-rocks-spritesheet.png',document.baseURI).href,
    {frameWidth:256,frameHeight:256,endFrame:7});
}

/** An upward hand sweep tears stone from the floor, then throws it forward. */
export class StoneshardBarrage<T extends Target> {
  rocks:Rock<T>[]=[];
  pool:Phaser.GameObjects.Image[]=[];
  constructor(readonly scene:Phaser.Scene){scene.textures.get('stoneshard-rocks').setFilter(Phaser.Textures.FilterMode.NEAREST);}
  get active(){return this.rocks.length>0;}
  reset(){this.rocks=[];for(const image of this.pool)image.setVisible(false);}
  cast(x:number,floor:number,face:number,targets:T[]){
    const hits=new Set<T>();
    for(let i=0;i<Math.max(6,targets.length);i++)this.rocks.push({x:x+face*(24+i%6*18),floor,face,index:i,age:-STONE_LIFT_DELAY-(i%6)*.025,target:targets[i],resolved:false,hits});
  }
  tick(dt:number,hit:(target:T,face:number)=>void){
    for(const rock of this.rocks){
      rock.age+=dt;
      if(rock.age>=IMPACT&&!rock.resolved){
        rock.resolved=true;
        if(rock.target&&rock.target.hp>0&&!rock.hits.has(rock.target)){rock.hits.add(rock.target);hit(rock.target,rock.face);}
      }
    }
    this.rocks=this.rocks.filter(rock=>rock.age<IMPACT+.16);
  }
  position(rock:Rock<T>){
    if(rock.age<STONE_LIFT_TIME){
      const t=ease(rock.age/STONE_LIFT_TIME);
      return {x:rock.x+rock.face*t*7,y:rock.floor-2-38*t,scale:.12+.88*t};
    }
    const t=Math.max(0,Math.min(1,(rock.age-STONE_LIFT_TIME)/STONE_FLIGHT_TIME));
    const endX=rock.target?.x??rock.x+rock.face*(108-rock.index%3*12),endY=rock.target?(rock.target.y??rock.floor)-58:rock.floor-28-(rock.index%3)*18;
    return {x:rock.x+rock.face*7+(endX-rock.x-rock.face*7)*t,y:rock.floor-40+(endY-rock.floor+40)*t-Math.sin(t*Math.PI)*18,scale:1};
  }
  render(g:Phaser.GameObjects.Graphics){
    this.pool.forEach(image=>image.setVisible(false));let index=0;
    for(const rock of this.rocks){
      const a=rock.age;
      if(a>=-.10&&a<.32){
        const fade=Math.min(1,(a+.10)/.06)*Math.min(1,(.32-a)/.12);
        g.lineStyle(2,0x342923,fade*.8);g.lineBetween(rock.x-11,rock.floor,rock.x+4,rock.floor-2);g.lineBetween(rock.x+4,rock.floor-2,rock.x+14,rock.floor+1);
        for(let i=0;i<5;i++){
          const t=Math.max(0,a+.03-i*.008),side=i%2?-1:1;
          g.fillStyle(i%2?0xa59478:0x71624e,fade*.7);g.fillRect(rock.x+side*t*(35+i*9),rock.floor-3-t*(35+i*7)+t*t*160,2+i%2,2);
        }
      }
      if(a<0||a>=IMPACT)continue;
      const p=this.position(rock),size=22+(rock.index%3)*4;
      let image=this.pool[index++];if(!image){image=this.scene.add.image(0,0,'stoneshard-rocks').setDepth(2.15);this.pool.push(image);}
      image.setTexture('stoneshard-rocks',rock.index%8).setPosition(p.x,p.y).setOrigin(.5).setFlipX(rock.face<0)
        .setScale(size/210*p.scale).setAngle(rock.face*(rock.index*29+Math.max(0,a)*250)).setAlpha(1).setVisible(true)
        .setData('stonePhase',a<STONE_LIFT_TIME?'lift':'flight');
    }
  }
}
