/** Trạng thái ván G1 (spec §5.1) — JSON thuần, không hàm, không Map/Set. */
import type { CardId, KingId, Level } from '../../data/types';
import type { ArmyPlan, BattleResult } from '../battle/types';

export const RUN_SAVE_VERSION = 2;

export interface BuildingState {
  uid: number;
  cardId: CardId;
  level: Level;
  placedYear: number;
}

export interface PlotState {
  unlocked: boolean;
  building: BuildingState | null;
}

export type RunPhase = 'planning' | 'battle' | 'reward' | 'yearEnd' | 'ended';
export type RngStream = 'draw' | 'reward';

export interface OfferState {
  kind: 'reward';
  cardIds: CardId[];
}

export interface RunStats {
  kills: number;
  battlesWon: number;
  battlesLost: number;
}

export interface RunState {
  version: number;
  seed: number;
  kingId: KingId;
  year: number;
  phase: RunPhase;
  lives: number;
  plots: PlotState[];
  throneLevel: Level;
  /** Mọi thẻ đang sở hữu; `hand ∪ drawPile ∪ discardPile` luôn bằng `deck` (spec §3.4). */
  deck: CardId[];
  hand: CardId[];
  drawPile: CardId[];
  discardPile: CardId[];
  played: boolean;
  army: ArmyPlan | null;
  offers: OfferState | null;
  rng: Record<RngStream, number>;
  stats: RunStats;
  nextUid: number;
  won: boolean | null;
}

export type IllegalReason =
  | 'locked'
  | 'throne'
  | 'occupied'
  | 'noBuilding'
  | 'noTarget'
  | 'notAdjacent'
  | 'wrongPhase'
  | 'alreadyPlayed'
  | 'notPlayed'
  | 'badTarget';

export type PlayTarget =
  | { kind: 'none' }
  | { kind: 'plot'; plot: number }
  | { kind: 'two'; first: number; second: number };

export type RunCommand =
  | { type: 'play'; handIndex: number; target: PlayTarget }
  | { type: 'skip' }
  | { type: 'startBattle' }
  | { type: 'battleResult'; result: BattleResult }
  | { type: 'pickOffer'; index: number | null }
  | { type: 'advance' };
