import Phaser from 'phaser';

const W = 1280, H = 720, G = 422;
type Fire = { x: number; y: number; size: number; smoke: boolean };
type SceneArt = { key: string; file: string; kind: number; ground: number; fires: Fire[] };
const brazier = (x: number, y: number): Fire => ({ x, y, size: 5, smoke: false });
const roof = (x: number, y: number, size = 12): Fire => ({ x, y, size, smoke: true });

export const SCENE_ART: SceneArt[] = [
  { key: 'town-art', file: 'level-01-greyfall-town.png', kind: 0, ground: 516,
    fires: [brazier(.046,.439),brazier(.254,.443),brazier(.645,.443),brazier(.94,.455),roof(.535,.311,8),roof(.797,.278),roof(.911,.218)] },
  { key: 'burning-town-art', file: 'level-02-greyfall-town-burning.png', kind: 1, ground: 516,
    fires: [brazier(.046,.439),brazier(.254,.443),brazier(.645,.443),brazier(.94,.455),roof(.297,.352),roof(.411,.356),roof(.503,.318),roof(.581,.344),roof(.774,.285),roof(.871,.245),roof(.927,.206),roof(.684,.083,8)] },
  { key: 'grasslands-art', file: 'levels-03-05-grasslands.png', kind: 2, ground: 522, fires: [] },
  { key: 'river-road-art', file: 'levels-06-08-river-road.png', kind: 3, ground: 524, fires: [] },
  { key: 'bridge-art', file: 'levels-09-10-bridge.png', kind: 4, ground: 548, fires: [] },
];

export function artForLevel(level: number) {
  return SCENE_ART[level <= 2 ? level - 1 : level <= 5 ? 2 : level <= 8 ? 3 : 4];
}

// Animate the original artwork by material, rather than moving the whole camera.
// UVs are measured from the image's top; flow goes towards increasing Y (the viewer).
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
float water(vec2 p) {
  float result=0.0;
  if(uKind>3.5) {
    // Foreground, three arch openings, and the upstream river are separate masks.
    float bank=.730+.025*pow(abs(p.x-.5)*2.0,4.0);
    result=smoothstep(bank,bank+.018,p.y);
    float a=.640+.075*pow((p.x-.233)/.142,2.0);
    float b=.639+.085*pow((p.x-.506)/.142,2.0);
    float c=.656+.065*pow((p.x-.777)/.115,2.0);
    result=max(result,band(p.x,.092,.371,.012)*smoothstep(a,a+.012,p.y));
    result=max(result,band(p.x,.365,.647,.012)*smoothstep(b,b+.012,p.y));
    result=max(result,band(p.x,.662,.891,.012)*smoothstep(c,c+.012,p.y));
    float depth=clamp((p.y-.416)/.110,0.0,1.0);
    float left=mix(.31,.135,depth),right=mix(.46,.84,depth);
    result=max(result,band(p.y,.416,.531,.008)*band(p.x,left,right,.018));
  } else if(uKind<1.5) {
    result=smoothstep(.885+.018*sin(p.x*10.0),.915+.018*sin(p.x*10.0),p.y);
  } else if(uKind>2.5) {
    result=band(p.x,0.0,.32,.012)*smoothstep(.765+p.x*.65,.790+p.x*.65,p.y);
    result=max(result,band(p.y,.388,.478,.012)*band(p.x,.285,.379,.02));
  } else {
    result=band(p.y,.285,.352,.016)*band(p.x,.650,.733,.015);
  }
  return clamp(result,0.0,1.0);
}
float sky(vec2 p) {
  if(uKind>3.5) return 1.0-smoothstep(.24,.29,p.y);
  if(uKind<1.5) return max(band(p.x,.275,.610,.025)*(1.0-smoothstep(.17,.23,p.y)),band(p.x,.61,.99,.025)*(1.0-smoothstep(.035,.08,p.y)));
  if(uKind>2.5) return band(p.x,.275,.640,.03)*(1.0-smoothstep(.14,.20,p.y));
  return 1.0-smoothstep(.095,.145,p.y);
}
float foliage(vec2 p, vec3 color) {
  float green=smoothstep(.005,.065,color.g-max(color.r*.83,color.b*1.04));
  float area=0.0;
  if(uKind>3.5) area=band(p.y,.40,.515,.025);
  else if(uKind>2.5) area=max(band(p.y,.045,.535,.025)*(1.0-band(p.x,.255,.59,.055)),band(p.y,.495,.550,.012));
  else if(uKind>1.5) area=max(band(p.y,.435,.544,.014),band(p.y,.12,.535,.025)*(1.0-band(p.x,.09,.93,.02)));
  else area=band(p.y,.555,.865,.03);
  return green*area;
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
  float leaves=foliage(p,original.rgb);
  if(leaves>.01) {
    float gust=sin(t*1.1-p.x*8.0)+.35*sin(t*2.0-p.x*17.0+p.y*9.0);
    float anchor=1.0-smoothstep(.47,.555,p.y);
    vec2 sway=vec2(gust*(.0007+.0011*anchor),sin(t*1.5+p.x*20.0)*.00035)*leaves;
    color=mix(color,art(p+sway),leaves);
  }
  float wet=water(p);
  bool broken=uBroken>.5&&screen.x>325.0/1280.0&&screen.x<640.0/1280.0&&screen.y>409.0/720.0;
  if(broken){p.y=.75+(screen.y-409.0/720.0)*.52;wet=1.0;color=art(p);}
  if(wet>.01) {
    float near=smoothstep(.65,1.0,p.y);
    vec2 ripple=vec2(sin(p.y*100.0-t*2.2+p.x*14.0)*(.0007+.0012*near),sin(p.x*125.0+p.y*70.0-t*1.7)*.0006);
    // Two advected samples crossfade before wrapping: no jump at the flow loop.
    float phase=fract(t*.08),phase2=fract(phase+.5);
    vec2 current=vec2((p.x-.5)*.008,.012+.026*near);
    vec2 a=p+ripple-current*phase, b=p+ripple-current*phase2;
    float blend=abs(phase*2.0-1.0);
    vec4 flowing=mix(art(a),art(b),blend);
    float safe=broken?1.0:min(water(a),water(b));
    float wave=sin(p.y*155.0-t*3.0+sin(p.x*42.0))*.035+sin(p.y*83.0+p.x*39.0-t*1.7)*.018;
    flowing.rgb*=1.0+wave;
    color=mix(color,flowing,wet*safe);
  }
  float flame=fireArea(p)*smoothstep(.14,.30,original.r-original.b)*smoothstep(.25,.65,original.r);
  if(flame>.01) {
    float frame=floor(t*15.0)/15.0;
    vec2 heat=vec2(sin(p.y*140.0-frame*8.0)*.0014,sin(p.x*125.0+frame*13.0)*.0018);
    vec4 burning=art(p+heat*flame);
    burning.rgb*=.98+.14*sin(frame*13.0+p.x*75.0)+.08*sin(frame*23.0+p.y*90.0);
    color=mix(color,burning,flame);
  }
  // Composite only moving materials over the full-detail, stationary artwork.
  float motion=clamp(cloud+leaves+wet+flame,0.0,1.0);
  if(broken)motion=1.0;
  gl_FragColor=vec4(color.rgb*motion,motion);
}
`;

class Ambience {
  time = 0;
  frameBudget = 0;
  broken = false;
  shader?: Phaser.GameObjects.Shader;
  smoke: Phaser.GameObjects.Graphics;
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
    this.smoke=scene.add.graphics();root.add(this.smoke);
    root.setData('artKey',config.key).setData('ambient',this);
    this.drawSmoke();
  }
  update(dt: number, broken: boolean) {
    this.time+=dt;
    this.frameBudget+=dt;
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
