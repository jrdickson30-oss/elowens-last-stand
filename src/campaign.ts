import { MAX_LEVEL } from './progression';

export const WAVES_PER_LEVEL = 3;
export type EnvironmentId = 'town' | 'grasslands' | 'road' | 'bridge';

export const CAMPAIGN = [
  { level: 1, environment: 'town', location: 'Greyfall Town', title: 'The alarm bells', story: 'The dead breach Greyfall. Hold the streets while the first families flee.', escape: 'THE TOWN GATE' },
  { level: 2, environment: 'town', location: 'Greyfall Town', title: 'The last families', story: 'The town is burning. Get the remaining refugees through the gate.', escape: 'THE TOWN GATE' },
  { level: 3, environment: 'grasslands', location: 'The Grasslands', title: 'Beyond the walls', story: 'The refugees cross open country. Keep the pursuing dead away from the caravan.', escape: 'THE CARAVAN' },
  { level: 4, environment: 'grasslands', location: 'The Grasslands', title: 'No shelter', story: 'There is nowhere to hide on the plains. Stand between the dead and the fleeing families.', escape: 'THE CARAVAN' },
  { level: 5, environment: 'grasslands', location: 'The Grasslands', title: 'The long retreat', story: 'The river road is close. Buy the refugees enough time to reach it.', escape: 'THE RIVER ROAD' },
  { level: 6, environment: 'road', location: 'The River Road', title: 'The narrow road', story: 'The road winds towards the river. Hold each bend while the refugees move ahead.', escape: 'TOWARDS THE RIVER' },
  { level: 7, environment: 'road', location: 'The River Road', title: 'Through the trees', story: 'The dead press through the woods. Keep the route to the crossing open.', escape: 'TOWARDS THE RIVER' },
  { level: 8, environment: 'road', location: 'The River Road', title: 'The river in sight', story: 'The crossing is finally in sight. Keep the last stretch of road clear.', escape: 'THE CROSSING' },
  { level: 9, environment: 'bridge', location: 'Greyfall Crossing', title: 'Hold the bridge', story: 'The refugees cross the river. Elowen stands at the bridgehead against the horde.', escape: 'ACROSS THE RIVER' },
  { level: 10, environment: 'bridge', location: 'Greyfall Crossing', title: 'Elowen’s last stand', story: 'Get the final refugees across. This crossing must not fall into the hands of the dead.', escape: 'ACROSS THE RIVER' },
] as const;

export function chapterForLevel(level: number) {
  return CAMPAIGN[Math.max(1, Math.min(MAX_LEVEL, level)) - 1];
}

export function enemyCount(level: number, wave: number) {
  return 5 + level * 3 + (wave - 1) * 2;
}
