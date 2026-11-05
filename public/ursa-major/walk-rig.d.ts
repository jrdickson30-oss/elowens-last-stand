export type UrsaWalkRig={parts:Record<string,{rect:[number,number,number,number];pivot:[number,number];end?:[number,number];sole?:number}>};
export type RigPoint={x:number;y:number};
export type RigLeg={hip:RigPoint;knee:RigPoint;ankle:RigPoint;stance:boolean;lift:number;footAngle:number};
export const URSA_WALK_FRAMES:number,URSA_WALK_SECONDS:number;
export function sampleUrsaWalk(phase:number):{phase:number;bob:number;bodyAngle:number;near:RigLeg;far:RigLeg};
export function createUrsaWalkClip():{frameCount:number;frameWidth:number;frameHeight:number;columns:number;bodyHeight:number;frameRects:[number,number,number,number][];frameAnchorX:number[];frameGroundY:number[];durationsMs:number[];method:string;strideWorldPx:number};
export function drawUrsaWalk(ctx:CanvasRenderingContext2D,image:CanvasImageSource,rig:UrsaWalkRig,phase:number):ReturnType<typeof sampleUrsaWalk>;
export function createUrsaWalkAtlas(image:CanvasImageSource,rig:UrsaWalkRig):{canvas:HTMLCanvasElement;clip:ReturnType<typeof createUrsaWalkClip>};
