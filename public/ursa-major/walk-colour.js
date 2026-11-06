// Match the companion sheet's exposure once at load time. This is a render
// treatment of whole drawings; alpha, pose geometry and timing stay unchanged.
export function prepareWalkPage(image,clip,sourceIndex=0){
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
 clip.frameRects.forEach(([x,y,w,h],i)=>{
  const brightness=clip.frameBrightness?.[i]??1;
  if((clip.frameSources?.[i]??0)!==sourceIndex||brightness===1)return;
  ctx.clearRect(x,y,w,h);ctx.filter=`brightness(${brightness})`;
  ctx.drawImage(image,x,y,w,h,x,y,w,h);ctx.filter='none';
 });
 return canvas;
}
