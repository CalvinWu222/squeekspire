export type RunMode = 'daily' | 'practice' | 'endless';

export interface HourData {
  hour: number;
  label: string;
  work: number;
  settlements: number;
  activeRounds: number;
  blocks: number;
}

export interface DayData {
  day: string;
  seed: number;
  source: 'live' | 'cached' | 'fallback';
  notice: string;
  hours: HourData[];
  totalWork: number;
  medianWork: number;
  difficulty: number;
  hibernation: boolean;
  peakRpm: number;
  blockHeight: number;
  blockProgress: number;
  completedBlocks: number;
  activeRounds: number;
  priceMultiplier: number;
  rareBonus: number;
  spinning: boolean;
}

export interface MapNode {
  id: number;
  act: number;
  hour: number;
  kind: 'battle' | 'elite' | 'boss' | 'rest' | 'shop' | 'event' | 'treasure';
  work: number;
  tier: number;
  jackpot: boolean;
  enemyId: string;
  connections: number[];
}
