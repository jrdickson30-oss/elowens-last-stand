import Phaser from 'phaser';

const W = 1280, H = 720, G = 422;
type Fire = { x: number; y: number; size: number; smoke: boolean };
type SceneArt = { key: string; file: string; kind: number; ground: number; fires: Fire[]; revision?: string };
const brazier = (x: number, y: number): Fire => ({ x, y, size: 5, smoke: false });
const roof = (x: number, y: number, size = 12): Fire => ({ x, y, size, smoke: true });

export const SCENE_ART: SceneArt[] = [
  { key: 'town-art', file: 'level-01-greyfall-town.png', kind: 0, ground: 516, revision: 'market-square-1',
    fires: [brazier(.046,.439),brazier(.254,.443),brazier(.645,.443),brazier(.94,.455),roof(.535,.311,8),roof(.797,.278),roof(.911,.218)] },
  { key: 'burning-town-art', file: 'level-02-greyfall-town-burning.png', kind: 1, ground: 516, revision: 'market-square-1',
    fires: [brazier(.046,.439),brazier(.254,.443),brazier(.645,.443),brazier(.94,.455),roof(.297,.352),roof(.411,.356),roof(.503,.318),roof(.581,.344),roof(.774,.285),roof(.871,.245),roof(.927,.206),roof(.684,.083,8)] },
  { key: 'grasslands-art', file: 'levels-03-05-grasslands.png', kind: 2, ground: 522, fires: [] },
  { key: 'river-road-art', file: 'levels-06-08-river-road.png', kind: 3, ground: 524, fires: [] },
  { key: 'bridge-art', file: 'levels-09-10-bridge.png', kind: 4, ground: 548, fires: [] },
];

export function artForLevel(level: number) {
  return SCENE_ART[level <= 2 ? level - 1 : level <= 5 ? 2 : level <= 8 ? 3 : 4];
}

// Animate the original artwork by material, rather than moving the whole camera.
// Water stays untouched. Ripples and foliage are independent sprites below.
const fragment = `
precision highp float;
uniform vec2 resolution;
uniform sampler2D iChannel0;
uniform float uAmbientTime;
uniform float uKind;
uniform float uGround;
uniform float uBroken;
varying vec2 fragCoord;

float band(float v, float lo, float hi, float feather) {
  return smoothstep(lo,lo+feather,v)*(1.0-smoothstep(hi-feather,hi,v));
}
float oval(vec2 p, vec2 center, vec2 radius) {
  return 1.0-smoothstep(.65,1.0,length((p-center)/radius));
}
vec4 art(vec2 p) {
  return texture2D(iChannel0,clamp(p,vec2(.0005),vec2(.9995)));
}
float sky(vec2 p) {
  if(uKind>3.5) return 1.0-smoothstep(.24,.29,p.y);
  if(uKind<1.5) return max(band(p.x,.275,.610,.025)*(1.0-smoothstep(.17,.23,p.y)),band(p.x,.61,.99,.025)*(1.0-smoothstep(.035,.08,p.y)));
  if(uKind>2.5) return band(p.x,.275,.640,.03)*(1.0-smoothstep(.14,.20,p.y));
  return 1.0-smoothstep(.095,.145,p.y);
}
float fireArea(vec2 p) {
  if(uKind>1.5) return 0.0;
  float f=oval(p,vec2(.046,.430),vec2(.018,.035))+oval(p,vec2(.254,.437),vec2(.017,.033));
  f+=oval(p,vec2(.645,.434),vec2(.018,.034))+oval(p,vec2(.94,.447),vec2(.018,.033));
  f+=oval(p,vec2(.535,.30),vec2(.025,.055))+oval(p,vec2(.797,.27),vec2(.045,.075))+oval(p,vec2(.911,.21),vec2(.070,.092));
  if(uKind>.5) {
    f+=oval(p,vec2(.297,.34),vec2(.043,.07))+oval(p,vec2(.411,.34),vec2(.06,.08));
    f+=oval(p,vec2(.503,.30),vec2(.05,.09))+oval(p,vec2(.581,.33),vec2(.05,.065));
    f+=oval(p,vec2(.774,.27),vec2(.04,.08))+oval(p,vec2(.871,.225),vec2(.052,.075));
    f+=oval(p,vec2(.684,.083),vec2(.05,.075));
  }
  return clamp(f,0.0,1.0);
}
void main() {
  vec2 screen=vec2(fragCoord.x/resolution.x,1.0-fragCoord.y/resolution.y);
  float ground=422.0/720.0;
  // Match the art's walking surface to the unchanged gameplay floor.
  vec2 p=screen;
  p.y=screen.y<ground?screen.y*uGround/ground:uGround+(screen.y-ground)*(1.0-uGround)/(1.0-ground);
  float t=uAmbientTime;
  vec4 original=art(p);
  float cloud=sky(p);
  vec2 wind=vec2(sin(t*.035)*.012,sin(t*.11)*.00035);
  vec4 color=mix(original,art(p+wind*cloud),cloud);
  bool broken=uBroken>.5&&screen.x>325.0/1280.0&&screen.x<640.0/1280.0&&screen.y>409.0/720.0;
  if(broken){p.y=.75+(screen.y-409.0/720.0)*.52;color=art(p);}
  float flame=fireArea(p)*smoothstep(.14,.30,original.r-original.b)*smoothstep(.25,.65,original.r);
  if(flame>.01) {
    float frame=floor(t*15.0)/15.0;
    vec2 heat=vec2(sin(p.y*140.0-frame*8.0)*.0014,sin(p.x*125.0+frame*13.0)*.0018);
    vec4 burning=art(p+heat*flame);
    burning.rgb*=.98+.14*sin(frame*13.0+p.x*75.0)+.08*sin(frame*23.0+p.y*90.0);
    color=mix(color,burning,flame);
  }
  // Composite only moving materials over the full-detail, stationary artwork.
  float motion=clamp(cloud+flame,0.0,1.0);
  if(broken)motion=1.0;
  gl_FragColor=vec4(color.rgb*motion,motion);
}
`;

type Ripple = { sprite: Phaser.GameObjects.Image; x: number; y: number; width: number; phase: number; travel: number; gold: boolean };
type Bough = { sprite: Phaser.GameObjects.Image; x: number; y: number; phase: number; swing: number };

// Reusable transparent sprites sit over a stationary clean river. Only a small
// fraction of its pixels moves; there is no texture warping or brightness pulse.
class LandscapeLayers {
  ripples: Ripple[] = [];
  boughs: Bough[] = [];
  grass: Bough[] = [];
  constructor(readonly root: Phaser.GameObjects.Container, readonly config: SceneArt) {
    const scene=root.scene;
    for(let frame=0;frame<4;frame++) {
      const key=`river-ripple-${frame}`;
      if(scene.textures.exists(key))continue;
      const g=scene.make.graphics({x:0,y:0});
      // Four restrained pixel shapes, with separated foam edges rather than
      // a solid bright stripe. Frames advance once per second.
      g.fillStyle(0xb4cbd0,.6);g.fillRect(8+frame,3,18,1);g.fillRect(35-frame,4,13,1);
      g.fillStyle(0xe4ece5,.8);g.fillRect(3+frame,4,7,1);g.fillRect(27,2,5,1);g.fillRect(46-frame,5,10,1);
      g.generateTexture(key,64,10);g.destroy();
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    if(!scene.textures.exists('wind-grass')) {
      const g=scene.make.graphics({x:0,y:0});
      g.fillStyle(0x526040);g.fillRect(8,6,2,14);g.fillRect(5,9,2,7);g.fillRect(12,5,2,9);
      g.fillStyle(0x9a9757);g.fillRect(8,2,1,8);g.fillRect(4,6,1,5);g.fillRect(14,1,1,8);
      g.generateTexture('wind-grass',20,20);g.destroy();
      scene.textures.get('wind-grass').setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    const ripple=(x:number,y:number,width:number,phase:number,travel=14,gold=false)=>{
      const sprite=scene.add.image(x,y,'river-ripple-0').setDisplaySize(width,6).setAlpha(gold?.17:.13);
      if(gold)sprite.setTint(0xffc778);
      root.add(sprite);this.ripples.push({sprite,x,y,width,phase,travel,gold});
    };
    if(config.kind===4) {
      for(let i=0;i<24;i++) {
        const x=110+(i*173)%1060,y=564+(i*41)%123;
        ripple(x,y,32+(i%4)*9,i*.83,16);
      }
      // Small highlights move with the same current, without pulsing the
      // sunset reflection already painted into the background.
      for(let i=0;i<9;i++)ripple(350+(i*47)%250,570+i*13,25+(i%3)*9,i*1.71,16,true);
      for(let i=0;i<5;i++)ripple(360+i*85,363+(i%2)*14,18,i*2.1,5,i<2);
    } else if(config.kind===3) {
      for(let i=0;i<10;i++)ripple(25+(i*37)%210,652+(i*13)%44,28,i*1.3,8,i%3===0);
    }
    const bough=(x:number,y:number,width:number,phase:number,swing:number,flip=false)=>{
      if(!scene.textures.exists('wind-bough'))return;
      const sprite=scene.add.image(x,y,'wind-bough').setOrigin(flip?.02:.98,.76).setFlipX(flip);
      sprite.setDisplaySize(width,width*.5);root.add(sprite);
      this.boughs.push({sprite,x,y,phase,swing});
    };
    if(config.kind===3) {
      bough(1265,75,260,.3,.035);bough(1245,185,255,1.2,.028);bough(1225,280,225,2.4,.03);
      bough(8,65,210,.8,.03,true);bough(5,220,120,2.2,.04,true);
    } else if(config.kind===2) {
      bough(4,212,100,.4,.035,true);bough(1276,248,135,1.3,.04);
    }
    // Stems pivot about their roots; the walking surface remains fixed.
    if(config.kind>=2)for(let i=0;i<32;i++) {
      const x=18+(i*89)%1240,y=config.kind===4?397:409;
      // Keep grass on the bridge's banks, away from its masonry.
      if(config.kind===4&&x>120&&x<1180)continue;
      const sprite=scene.add.image(x,y,'wind-grass').setOrigin(.5,1).setAlpha(.7);
      sprite.setScale(.55+(i%3)*.15);root.add(sprite);
      this.grass.push({sprite,x,y,phase:i*.61,swing:.13});
    }
  }
  update(time:number) {
    for(const r of this.ripples) {
      const cycle=((time+r.phase)%14)/14;
      r.sprite.setPosition(r.x+(r.x-W/2)*cycle*.006,r.y+cycle*r.travel);
      // Fade only the tiny overlay at its loop boundary; the river stays steady.
      const envelope=Math.min(1,cycle*7,(1-cycle)*7);
      r.sprite.setAlpha((r.gold?.17:.13)*envelope);
      r.sprite.setTexture(`river-ripple-${Math.floor(time+r.phase)%4}`);
      r.sprite.setDisplaySize(r.width,6);
    }
    for(const b of [...this.boughs,...this.grass]) {
      const gust=Math.sin(time*.65+b.phase)+.18*Math.sin(time*1.1+b.phase*2);
      b.sprite.setRotation(gust*b.swing);
    }
  }
}

class Ambience {
  time = 0;
  frameBudget = 0;
  broken = false;
  shader?: Phaser.GameObjects.Shader;
  smoke: Phaser.GameObjects.Graphics;
  layers: LandscapeLayers;
  constructor(readonly root: Phaser.GameObjects.Container, readonly config: SceneArt) {
    const scene=root.scene, texture=scene.textures.get(config.key),source=texture.getSourceImage() as HTMLImageElement;
    const ground=config.ground/source.height;
    if(!texture.has('upper'))texture.add('upper',0,0,0,source.width,config.ground);
    if(!texture.has('lower'))texture.add('lower',0,0,config.ground,source.width,source.height-config.ground);
    root.add(scene.add.image(0,0,config.key,'upper').setOrigin(0).setDisplaySize(W,G));
    root.add(scene.add.image(0,G,config.key,'lower').setOrigin(0).setDisplaySize(W,H-G));
    if(scene.game.renderer.type===Phaser.WEBGL) {
      const base=new Phaser.Display.BaseShader('living-scenery',fragment,undefined,{
        uAmbientTime:{type:'1f',value:0},uKind:{type:'1f',value:config.kind},uGround:{type:'1f',value:ground},uBroken:{type:'1f',value:0},
      });
      // Half-size material effects, nearest-scaled: crisp two-pixel motion,
      // while architecture and the ground remain at full display resolution.
      this.shader=scene.add.shader(base,0,0,W/2,H/2,[config.key],{repeat:false,wrapS:'clamp_to_edge',wrapT:'clamp_to_edge',minFilter:'nearest',magFilter:'nearest'});
      this.shader.setRenderToTexture('ambient-surface');
      this.shader.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.shader.setVisible(false);
      root.add(this.shader);
      root.add(scene.add.image(W/2,H/2,'ambient-surface').setFlipY(true).setDisplaySize(W,H));
      const hide=()=>this.shader?.setVisible(false);
      scene.game.events.on(Phaser.Core.Events.POST_RENDER,hide);
      root.once(Phaser.GameObjects.Events.DESTROY,()=>scene.game.events.off(Phaser.Core.Events.POST_RENDER,hide));
    }
    this.layers=new LandscapeLayers(root,config);
    this.smoke=scene.add.graphics();root.add(this.smoke);
    root.setData('artKey',config.key).setData('ambient',this);
    this.layers.update(0);
    this.drawSmoke();
  }
  update(dt: number, broken: boolean) {
    this.time+=dt;
    this.frameBudget+=dt;
    this.layers.update(this.time);
    // The slow ambient effects need 15 art frames per second, independently of combat.
    // Reuse the cached surface between frames, and do no shader work while paused.
    if(dt>0&&this.frameBudget<1/15&&broken===this.broken)return;
    this.frameBudget%=1/15;this.broken=broken;
    this.shader?.setUniform('uAmbientTime.value',this.time).setUniform('uBroken.value',broken?1:0);
    this.shader?.setVisible(true);
    this.drawSmoke();
  }
  drawSmoke() {
    const g=this.smoke;g.clear();
    const ground=this.config.ground/941;
    for(const [index,fire] of this.config.fires.entries()) {
      const x=fire.x*W,y=fire.y/ground*G;
      if(fire.smoke)for(let i=0;i<10;i++) {
        const age=(this.time+i*1.17+index*.43)%12;
        const size=fire.size*(.65+age*.13);
        const px=Math.round(x+age*4+Math.sin(age*.65+index)*size*.5);
        const py=Math.round(y-age*(9+index%3));
        const alpha=Math.sin(age/12*Math.PI)*.095;
        g.fillStyle(i%2?0x303438:0x464b4c,alpha);
        g.fillRect(px-size,py-size*.45,size*1.5,size*.85);
        g.fillRect(px-size*.65,py-size*.85,size*.8,size*1.35);
      }
      for(let i=0;i<3;i++) {
        const age=(this.time+i*1.05+index*.77)%3.3;
        const px=Math.round(x+Math.sin(age*2+index+i)*5+age*5),py=Math.round(y-age*22);
        g.fillStyle(i%2?0xffc878:0xf79747,Math.sin(age/3.3*Math.PI)*.7);
        g.fillRect(px,py,age<1?2:1,2);
      }
      if(!this.shader) {
        // A small flame flicker remains available without WebGL.
        g.fillStyle(0xf6b252,.35+.15*Math.sin(this.time*13+index));
        g.fillRect(Math.round(x-2),Math.round(y-6-Math.sin(this.time*11+index)*2),4,7);
      }
    }
  }
}

export function addAnimatedArt(scene: Phaser.Scene, level: number, environment: string, escape: string) {
  const config=artForLevel(level);
  if(!scene.textures.exists(config.key))return null;
  const root=scene.add.container(0,0).setDepth(0).setData('environment',environment);
  new Ambience(root,config);
  const shade=scene.add.graphics();
  shade.fillStyle(0x061619,.12);shade.fillRect(0,0,W,100);
  shade.fillGradientStyle(0x081519,0x081519,0x081519,0x081519,0,0,.45,.45);shade.fillRect(0,650,W,70);
  const overlay=scene.add.renderTexture(0,0,W,H).setOrigin(0);
  overlay.draw(shade);shade.destroy();root.add(overlay);
  root.add(scene.add.text(290,G+25,`← ${escape}`,{fontFamily:'Arial',fontSize:'10px',color:'#c7c7aa',letterSpacing:2}));
  return root;
}

export function updateEnvironment(root: Phaser.GameObjects.Container, dt: number, broken=false) {
  (root.getData('ambient') as Ambience|undefined)?.update(dt,broken);
}
