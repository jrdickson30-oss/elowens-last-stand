type WalkColourClip={frameRects:[number,number,number,number][];frameSources?:number[];frameBrightness?:number[]};
export function prepareWalkPage(image:HTMLImageElement|HTMLCanvasElement,clip:WalkColourClip,sourceIndex?:number):HTMLCanvasElement;
