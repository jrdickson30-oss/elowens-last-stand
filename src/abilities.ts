export const ABILITY_SLOTS = ['U', 'I', 'O'] as const;
export const CHAMPION_ABILITIES = [
  { id: 'bash', name: 'Shield Bash', slot: 'K', cost: 25, cooldown: 0, description: 'Shove and stagger nearby enemies. 25 stamina, no cooldown. Choosing this locks out Sentinel Initiate.' },
  { id: 'throw', name: 'Sentinel Initiate', slot: 'K', cost: 25, cooldown: 0, description: 'Throw a returning shield. 25 stamina, no cooldown. You cannot block or throw again until it returns. Choosing this locks out Shield Bash.' },
  { id: 'protector', name: 'Protector', slot: 'PASSIVE', cost: 0, cooldown: 0, description: 'Automatically intercept attackers threatening survivors within 120 px, while your shield is available.' },
  { id: 'rally', name: 'Rallying Cry', slot: 'ACTIVE', cost: 0, cooldown: 10, description: 'Call nine arrows from beyond the bridge into an area ahead of Elowen. 10-second cooldown, no stamina cost. Upgrades reduce the cooldown to 8, then 6 seconds.' },
  { id: 'focus', name: 'Battle Focus', slot: 'ACTIVE', cost: 20, cooldown: 0, description: 'For 8 seconds: +75% sword damage and invulnerability. 20 stamina, no cooldown. Prevents spells and ends Warrior’s Shield. Reusing refreshes the duration.' },
  { id: 'cripple', name: 'Crippling Strike', slot: 'ACTIVE', cost: 20, cooldown: 0, description: 'Prime your next sword hit: +50% damage and immobilise targets for 3 seconds. Expires after 8 seconds. 20 stamina, no cooldown.' },
  { id: 'reach', name: 'Strike Through', slot: 'ACTIVE', cost: 20, cooldown: 0, description: 'Double sword reach for 8 seconds. Works with Elowen’s one-handed sword. 20 stamina, no cooldown. Reusing refreshes the duration.' },
] as const;
export type ChampionId = typeof CHAMPION_ABILITIES[number]['id'];
export type ActiveAbilityId = 'rally' | 'focus' | 'cripple' | 'reach';
export function isActiveAbility(id: string): id is ActiveAbilityId {
  return CHAMPION_ABILITIES.some(a => a.id === id && a.slot === 'ACTIVE');
}
