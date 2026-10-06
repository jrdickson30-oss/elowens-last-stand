export const SPELLS = [
  { id: 'ember', key: 'E', label: 'E', name: 'Ember Strike', cost: 24, cooldown: .75, color: 0xf89d43 },
  { id: 'ice', key: 'ONE', label: '1', name: 'Ice Lance', cost: 32, cooldown: 3, color: 0x8cd7e5 },
  { id: 'ward', key: 'TWO', label: '2', name: 'Warrior’s Shield', cost: 28, cooldown: 12, color: 0xd9c591 },
  { id: 'volley', key: 'THREE', label: '3', name: 'Hunter’s Volley', cost: 36, cooldown: 4, color: 0xf6e4b0 },
  { id: 'stone', key: 'FOUR', label: '4', name: 'Stoneshard Barrage', cost: 30, cooldown: 3, color: 0xb9afa0 },
  { id: 'vines', key: 'FIVE', label: '5', name: 'Wall of Vines', cost: 35, cooldown: 10, color: 0x92b56d },
] as const;
export type SpellId = typeof SPELLS[number]['id'];
