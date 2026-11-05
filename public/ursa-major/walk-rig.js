// Shared by the game and preview: one stable drawing of each body part,
// articulated into a stride. Stance paws travel opposite the walking speed.
const TAU=Math.PI*2;
export const URSA_WALK_FRAMES=120,URSA_WALK_SECONDS=2;
const mod=n=>(n%1+1)%1;

export function sampleUrsaWalk(phase){
 const p=mod(phase),bob=.55*(1-Math.cos(p*TAU*2));
 const leg=(offset,hipX)=>{
  const q=mod(p+offset),stance=q<.5,t=stance?q*2:(q-.5)*2;
  // The swing cubic matches the stance velocity at both joins. A sine-squared
  // lift also arrives with zero vertical speed; there is no snap at contact.
  const x=stance?16-32*t:-16-32*t+192*t*t-128*t*t*t;
  const lift=stance?0:7*Math.sin(Math.PI*t)**2;
  const ankle={x,y:-10.35-lift},hip={x:hipX,y:-54+bob};
  const dx=ankle.x-hip.x,dy=ankle.y-hip.y,d=Math.hypot(dx,dy);
  const thigh=26,shin=27,along=(thigh*thigh-shin*shin+d*d)/(2*d);
  const bend=Math.sqrt(Math.max(0,thigh*thigh-along*along));
  const knee={x:hip.x+along*dx/d+bend*dy/d,y:hip.y+along*dy/d-bend*dx/d};
  return {hip,knee,ankle,stance,lift,footAngle:stance?0:8*Math.PI/180*Math.sin(t*TAU)*Math.sin(t*Math.PI)};
 };
 return {phase:p,bob,bodyAngle:.35*Math.PI/180*Math.sin(p*TAU),near:leg(0,-10),far:leg(.5,10)};
}

export function createUrsaWalkClip(){
 const frameWidth=320,frameHeight=288,columns=12;
 return {frameCount:URSA_WALK_FRAMES,frameWidth,frameHeight,columns,bodyHeight:248,
  frameRects:Array.from({length:URSA_WALK_FRAMES},(_,i)=>[i%columns*frameWidth,Math.floor(i/columns)*frameHeight,frameWidth,frameHeight]),
  frameAnchorX:Array(URSA_WALK_FRAMES).fill(144),frameGroundY:Array(URSA_WALK_FRAMES).fill(268),
  durationsMs:Array(URSA_WALK_FRAMES).fill(URSA_WALK_SECONDS*1000/URSA_WALK_FRAMES),
  method:'articulated-planted-stride',strideWorldPx:64};
}

export function drawUrsaWalk(ctx,image,rig,phase){
 const pose=sampleUrsaWalk(phase),parts=rig.parts;
 const part=(name,x,y,angle=0,scale=1,width=1)=>{
  const p=parts[name],[sx,sy,w,h]=p.rect;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale*width,scale);
  ctx.drawImage(image,sx,sy,w,h,sx-p.pivot[0],sy-p.pivot[1],w,h);ctx.restore();
 };
 const segment=(name,a,b)=>{
  const p=parts[name],dx=p.end[0]-p.pivot[0],dy=p.end[1]-p.pivot[1];
  part(name,a.x,a.y,Math.atan2(b.y-a.y,b.x-a.x)-Math.atan2(dy,dx),Math.hypot(b.x-a.x,b.y-a.y)/Math.hypot(dx,dy),name.endsWith('Thigh')?1.18:1.1);
 };
 const leg=(side,l)=>{
  segment(side+'Thigh',l.hip,l.knee);segment(side+'Shin',l.knee,l.ankle);
  const p=parts[side+'Paw'];part(side+'Paw',l.ankle.x,l.ankle.y,l.footAngle,10.35/(p.sole-p.pivot[1]));
 };
 ctx.save();ctx.imageSmoothingEnabled=true;
 part('cape',-22,-102+pose.bob,Math.sin(pose.phase*TAU-.55)*.018,.23);
 leg('far',pose.far);leg('near',pose.near);
 part('tabard',6,-51+pose.bob,-Math.sin(pose.phase*TAU-.35)*.025,.095);
 part('body',0,-54+pose.bob,pose.bodyAngle,70/289);
 ctx.restore();return pose;
}

export function createUrsaWalkAtlas(image,rig){
 const clip=createUrsaWalkClip(),canvas=document.createElement('canvas');
 canvas.width=clip.columns*clip.frameWidth;canvas.height=Math.ceil(clip.frameCount/clip.columns)*clip.frameHeight;
 const ctx=canvas.getContext('2d');
 for(let i=0;i<clip.frameCount;i++){
  const [x,y,w,h]=clip.frameRects[i];ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  ctx.translate(x+clip.frameAnchorX[i],y+clip.frameGroundY[i]);ctx.scale(2,2);
  drawUrsaWalk(ctx,image,rig,i/clip.frameCount);ctx.restore();
 }
 return {canvas,clip};
}
