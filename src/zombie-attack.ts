import type {VineBarrier} from './vine-wall';

export const ZOMBIE_CLAW_IMPACT=.22;
export const ZOMBIE_CLAW_DURATION=.64;
export type ZombieClaw={elapsed:number;face:number;landed:boolean;target:{kind:'hero'}|{kind:'wall';barrier:VineBarrier}};
