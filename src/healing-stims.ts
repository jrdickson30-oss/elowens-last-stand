import type Phaser from 'phaser';

export const HEALING_STIM_DROP_CHANCE = .1;
export const HEALING_STIM_SP = 25;
type Stim = {x:number;y:number;age:number};

export class HealingStims {
  drops:Stim[]=[];
  constructor(readonly floor:number,readonly left:number,readonly right:number) {}
  reset(){this.drops=[];}
  tryDrop(x:number,roll=Math.random()) {
    if(roll>=HEALING_STIM_DROP_CHANCE)return false;
    // Ranged kills beyond the walking area still leave reachable supplies.
    this.drops.push({x:Math.max(this.left,Math.min(this.right,x)),y:this.floor,age:0});
    return true;
  }
  tick(dt:number){for(const stim of this.drops)stim.age+=dt;}
  collect(x:number,y:number,hp:number,maxHp:number) {
    if(hp<=0||hp>=maxHp||Math.abs(y-this.floor)>28)return 0;
    let restored=0;
    this.drops=this.drops.filter(stim=>{
      if(Math.abs(x-stim.x)>30||hp+restored>=maxHp)return true;
      restored+=Math.min(HEALING_STIM_SP,maxHp-hp-restored);
      return false;
    });
    return restored;
  }
  render(g:Phaser.GameObjects.Graphics) {
    for(const stim of this.drops) {
      const {x,y,age}=stim,bob=Math.sin(age*3)*2,top=y-29+bob;
      g.fillStyle(0x061516,.4);g.fillEllipse(x,y+2,28,7);
      g.fillStyle(0x65e6a3,.09+.04*Math.sin(age*4));g.fillCircle(x,top+12,23);
      g.lineStyle(1,0x91f4be,.45);g.strokeEllipse(x,y-1,29,7);
      g.fillStyle(0x172f2a);g.fillRoundedRect(x-10,top-1,20,27,3);
      g.fillStyle(0x62c98e);g.fillRoundedRect(x-8,top+3,16,20,2);
      g.fillStyle(0xd4e8dc);g.fillRect(x-6,top,12,4);g.fillRect(x-6,top+23,12,3);
      g.fillStyle(0xeffff4);g.fillRect(x-2,top+7,4,12);g.fillRect(x-6,top+11,12,4);
      g.fillStyle(0xc4ffdc,.6);g.fillRect(x-6,top+5,2,4);
    }
  }
}
