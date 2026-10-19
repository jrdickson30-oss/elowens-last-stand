import type {VineBarrier} from './vine-wall';

export const ZOMBIE_CLAW_IMPACT=.22;
export const ZOMBIE_CLAW_DURATION=.64;
export const ZOMBIE_BLOCK_DURATION=.4;
export type ZombieBlock={elapsed:number;face:number;fresh?:boolean};
export type ZombieClaw={elapsed:number;face:number;landed:boolean;variant?:'claw'|'backhand';target:{kind:'hero'}|{kind:'wall';barrier:VineBarrier}};
