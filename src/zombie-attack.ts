import type {VineBarrier} from './vine-wall';

export const ZOMBIE_CLAW_IMPACT=.22;
export const ZOMBIE_CLAW_DURATION=.64;
export const FAST_ZOMBIE_CLAW_IMPACT=.48;
export const FAST_ZOMBIE_CLAW_DURATION=.96;
export const ZOMBIE_BLOCK_DURATION=.4;
export type ZombieBlock={elapsed:number;face:number;fresh?:boolean};
export type ZombieClaw={elapsed:number;face:number;landed:boolean;duration?:number;impactAt?:number;variant?:'claw'|'backhand';target:{kind:'hero'}|{kind:'wall';barrier:VineBarrier}};
