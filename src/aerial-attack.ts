import type { RisingAttack } from './rising-attack';

export const AIR_SPIN_DURATION=.4;
export const DIVE_WINDUP=.1;
export const DIVE_RECOVERY=.24;
export type AerialAttack<T> = RisingAttack<T> & {
  kind:'spin'|'dive'; resumeVy:number; landingElapsed:number|null;
};
