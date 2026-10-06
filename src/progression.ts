// Chaosbound: Champion SP, Character Progression table, Proficiency, Weapons.
// Keep the prototype's starting health/damage. Extra dice use fixed averages:
// one-handed longsword d10 = 5.5; Sentinel's shield d4 = 2.5.
export const MAX_LEVEL = 10;
export const SP_PER_LEVEL = 12;
const TIERS = [
  { level: 1, name: 'Novice', proficiency: 1, weaponDice: 0, armour: 0 },
  { level: 2, name: 'Apprentice', proficiency: 2, weaponDice: 1, armour: 1 },
  { level: 5, name: 'Journeyman', proficiency: 3, weaponDice: 1, armour: 1 },
  { level: 8, name: 'Hero', proficiency: 4, weaponDice: 2, armour: 2 },
  { level: 10, name: 'Legend', proficiency: 5, weaponDice: 3, armour: 2 },
] as const;

export function championProgression(level: number) {
  level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const tier = [...TIERS].reverse().find(t => level >= t.level)!;
  return {
    level,
    maxHealth: 100 + SP_PER_LEVEL * (level - 1),
    tier: tier.name,
    proficiencyBonus: tier.proficiency,
    bonusWeaponDice: tier.weaponDice,
    swordDamage: 27 + tier.weaponDice * 5.5,
    shieldDamageBonus: tier.weaponDice * 2.5,
    // AR normally affects hit rolls. Real-time combat uses flat reduction.
    armourBonus: tier.armour,
  };
}
