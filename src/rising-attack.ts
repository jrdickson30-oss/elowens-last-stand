export const RISING_DURATION = .56;
export const JUMP_COMBO_WINDOW = .1;

export type RisingAttack<T> = {
  elapsed: number; face: number; range: number; extended: boolean;
  damage: number; rootDuration: number; hits: Set<T>;
};

// Screen coordinates: low behind -> low in front -> overhead -> high behind.
export function risingAngle(elapsed: number) {
  const points = [[0,2.5],[.06,.65],[.13,0],[.21,-.8],[.3,-1.9],[.4,-2.8],[RISING_DURATION,-2.8]];
  const t=Math.min(RISING_DURATION,Math.max(0,elapsed));
  for(let i=1;i<points.length;i++) {
    const [end,angle]=points[i],[start,previous]=points[i-1];
    if(t<=end)return previous+(angle-previous)*(t-start)/(end-start);
  }
  return -2.8;
}

export function risingSweepHits(dx: number, dy: number, range: number, from: number, to: number) {
  // A vertical capsule models an enemy's body, including the low sweep at
  // its legs and an overhead strike against its head.
  return [-20, 0, 20].some(offset => sweepHitsCircle(dx, dy + offset, range, from, to));
}

function sweepHitsCircle(dx: number, dy: number, range: number, from: number, to: number) {
  const distance = Math.hypot(dx, dy), targetRadius = 26;
  if (distance > range + targetRadius) return false;
  if (distance <= targetRadius) return true;
  // Expand by the target's silhouette and sweep the entire interval, so an
  // enemy cannot fall between samples at a lower frame rate.
  const tolerance = Math.asin(Math.min(1, targetRadius / distance));
  const low = risingAngle(to) - tolerance, high = risingAngle(from) + tolerance;
  const angle = Math.atan2(dy, dx);
  return [-Math.PI * 2, 0, Math.PI * 2].some(turn => angle + turn >= low && angle + turn <= high);
}
