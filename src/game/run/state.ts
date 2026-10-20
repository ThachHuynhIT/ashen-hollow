/** Trạng thái ván G1 (spec §5.1) — JSON thuần, không hàm, không Map/Set. */
import type { Rules } from '../../data/rules';
import type { CardId, KingId, Level, StatKey } from '../../data/types';
import type { ArmyPlan, BattleResult } from '../battle/types';

export const RUN_SAVE_VERSION = 3;

export interface BuildingState {
  uid: number;
  cardId: CardId;
  level: Level;
  /** Bùa đang gắn, theo thứ tự gắn lần đầu (spec §4.3). */
  enchants: { cardId: CardId; stacks: number }[];
  placedYear: number;
  /** % vĩnh viễn từ sách phép (Khắc Ấn Núi…). */
  permanent: Partial<Record<StatKey, number>>;
}

export interface PlotState {
  unlocked: boolean;
  building: BuildingState | null;
}

export type RunPhase = 'planning' | 'battle' | 'reward' | 'conquest' | 'yearEnd' | 'ended';
export type RngStream = 'draw' | 'reward' | 'calendar';

/** Số lần một vua địch đã tấn công và kết cục (spec §3.7). */
export interface EnemyKingState {
  attacks: number;
  status: 'pending' | 'conquered' | 'fled';
}

export interface OfferState {
  kind: 'reward';
  cardIds: CardId[];
}

export interface RunStats {
  kills: number;
  battlesWon: number;
  battlesLost: number;
  goldEarned: number;
  conquered: number;
}

export interface RunState {
  version: number;
  rules: Rules;
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
  /** Đá Tảng tự bắn (spec §7.4); giữ qua các trận và các năm. */
  autoFire: boolean;
  gold: number;
  rerollsThisYear: number;
  /** Số ô đã MUA bằng vàng (giá ô kế tiếp, spec §3.11). */
  purchasedPlots: number;
  /** Uid công trình không trả được phí duy trì năm nay; tính lại mỗi `startYear`. */
  idleUids: number[];
  /** Hai vua địch K1, K2 (G2); rỗng ở lịch toàn Thổ Phỉ. */
  enemyKings: KingId[];
  enemies: Partial<Record<KingId, EnemyKingState>>;
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
  | 'notEnoughGold'
  | 'badTarget';

export type PlayTarget =
  | { kind: 'none' }
  | { kind: 'plot'; plot: number }
  | { kind: 'two'; first: number; second: number };

export type RunCommand =
  | { type: 'play'; handIndex: number; target: PlayTarget }
  /** Bán/bỏ đúng một thẻ thay cho việc chơi thẻ. */
  | { type: 'discard'; handIndex: number }
  /** Bỏ cả tay và rút lại, trả `rerollCost` vàng. */
  | { type: 'reroll' }
  /** Mua một ô khoá kề ô đã mở bằng vàng (spec §3.11). */
  | { type: 'unlockPlot'; plot: number }
  | { type: 'setAutoFire'; on: boolean }
  | { type: 'startBattle' }
  | { type: 'battleResult'; result: BattleResult }
  | { type: 'pickOffer'; index: number | null }
  | { type: 'advance' };
