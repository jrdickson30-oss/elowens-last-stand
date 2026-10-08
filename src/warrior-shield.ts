import Phaser from 'phaser';

// Proportions and timing from the approved round Warrior's Shield preview.
export class WarriorShield {
  readonly radius=72;
  readonly centreOffset=198*72/280;
  readonly back:Phaser.GameObjects.Image;
  readonly front:Phaser.GameObjects.Image;
  private rearTexture:Phaser.Textures.CanvasTexture;
  private frontTexture:Phaser.Textures.CanvasTexture;
  constructor(scene:Phaser.Scene){
    this.rearTexture=scene.textures.createCanvas('warrior-shield-rear',256,256)!;
    this.frontTexture=scene.textures.createCanvas('warrior-shield-front',256,256)!;
    this.back=scene.add.image(0,0,this.rearTexture.key).setDepth(.75).setScale(this.radius/112).setVisible(false);
    this.front=scene.add.image(0,0,this.frontTexture.key).setDepth(1.75).setScale(this.radius/112).setVisible(false);
  }
  render(x:number,feetY:number,remaining:number,playing:boolean){
    const visible=playing&&remaining>0;
    this.back.setVisible(visible);this.front.setVisible(visible);
    if(!visible)return;
    const elapsed=6-remaining,centreY=feetY-this.centreOffset;
    this.back.setPosition(x,centreY);this.front.setPosition(x,centreY);
    this.front.setData('shieldElapsed',elapsed);
    const rear=this.rearTexture.context,front=this.frontTexture.context;
    for(const ctx of [rear,front]){ctx.clearRect(0,0,256,256);ctx.save();ctx.translate(128,128);ctx.scale(.4,.4)}
    const radius=280,pulse=.5+.5*Math.sin(elapsed*Math.PI*2/3.2);
    const aura=rear.createRadialGradient(0,0,56,0,0,radius*1.12);
    aura.addColorStop(0,'rgba(255,213,111,.015)');aura.addColorStop(.78,'rgba(255,213,111,.035)');
    aura.addColorStop(.84,`rgba(255,214,120,${.11+pulse*.045})`);aura.addColorStop(.9,'rgba(255,224,156,.04)');aura.addColorStop(1,'rgba(255,224,156,0)');
    rear.fillStyle=aura;rear.beginPath();rear.arc(0,0,radius*1.12,0,Math.PI*2);rear.fill();
    rear.shadowColor='#ffd776';rear.shadowBlur=16;rear.strokeStyle=`rgba(255,221,137,${.45+pulse*.15})`;rear.lineWidth=2;
    rear.beginPath();rear.arc(0,0,radius,0,Math.PI*2);rear.stroke();rear.restore();
    front.beginPath();front.arc(0,0,radius-2,0,Math.PI*2);front.clip();
    const shell=front.createLinearGradient(-radius,0,radius,0);
    shell.addColorStop(0,'rgba(255,225,151,.08)');shell.addColorStop(.35,'rgba(255,225,151,.018)');shell.addColorStop(.7,'rgba(255,225,151,.025)');shell.addColorStop(1,'rgba(255,225,151,.10)');
    front.fillStyle=shell;front.fillRect(-radius,-radius,radius*2,radius*2);
    const phase=elapsed%3.2;
    if(phase>=1.45&&phase<2.55){
      const p=(phase-1.45)/1.1,fade=Math.sin(p*Math.PI),sweep=-radius-100+p*(radius*2+200);
      front.save();front.translate(sweep,0);front.rotate(.28);
      const shine=front.createLinearGradient(-34,0,34,0);
      shine.addColorStop(0,'rgba(255,246,206,0)');shine.addColorStop(.37,`rgba(255,228,151,${.13*fade})`);shine.addColorStop(.48,`rgba(255,255,237,${.48*fade})`);shine.addColorStop(.56,`rgba(255,244,195,${.2*fade})`);shine.addColorStop(1,'rgba(255,246,206,0)');
      front.fillStyle=shine;front.fillRect(-34,-radius-70,68,radius*2+140);front.restore();
    }
    front.shadowColor='#ffdc8b';front.shadowBlur=12;front.strokeStyle='rgba(255,230,170,.32)';front.lineWidth=2;
    front.beginPath();front.ellipse(0,208,radius*.47,16,0,0,Math.PI*2);front.stroke();front.restore();
    this.rearTexture.refresh();this.frontTexture.refresh();
  }
}
