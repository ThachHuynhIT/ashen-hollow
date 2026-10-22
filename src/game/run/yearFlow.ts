/** Khởi tạo ván và bước sang năm mới (spec §3.2, §5.5 bước 1, 6). Thuần, không sửa đầu vào. */
import { hashSeed } from '../../core/random';
import { RULES_G1, PLAYABLE_KINGS_G2, type Rules } from '../../data/rules';
import { RUN, START_DECK_G1 } from '../../data/run';
import { yearIncome } from './income';
import type { KingId } from '../../data/types';
import { armyBudget, composeArmy } from '../battle/compose';
import type { Content } from '../cards/registry';
import { THRONE_PLOT, initialPlots } from './board';
import { calendarFor, pickEnemyKings, slotMultFor, startDeck } from './calendar';
import { freeRerollsPerYear } from './decrees';
import { finishYearStart } from './flow';
import { offerQuest } from './quests';
import { RUN_SAVE_VERSION } from './state';
import type { RunState } from './state';

/** Sang năm kế: bốc đạo quân và rút tay mới, về pha lập kế hoạch. */
export function startYear(state: RunState, content: Content): RunState {
  const year = state.year + 1;
  const slot = calendarFor(state.rules)[year - 1] ?? { kind: 'raiders' as const };
  const kingId = slot.kind === 'king' ? state.enemyKings[slot.king - 1] : undefined;
  const king = kingId === undefined ? null : content.king(kingId);
  // Cờ hiệu `enemyCostPct` làm đổi giá đơn vị khi tính ngân sách (spec §3.6).
  const costMult =
    1 +
    (king?.banner.effects.reduce((sum, e) => (e.type === 'enemyCostPct' ? sum + e.pct : sum), 0) ?? 0) / 100;
  const entries = (kingId === undefined ? content.raiderRoster() : content.enemyRoster(kingId)).map((r) => ({
    unit: r.unit.id,
    weight: r.weight,
    enemyCost: r.unit.enemyCost * costMult,
  }));
  const army = composeArmy(
    entries,
    armyBudget(year, slotMultFor(slot)),
    year,
    state.seed,
    slot.kind === 'king' && king !== null && kingId !== undefined
      ? { attacker: kingId, attackNo: slot.attack, banner: king.banner.id }
      : {},
  );
  // Thứ tự §5.5: phí duy trì (kiểm với vàng đang có) → thuế → thu nhập công trình.
  const income = yearIncome(state, content, state.gold);
  const gained = RUN.taxPerYear + Math.max(0, income.delta);
  // Rút bài tách khỏi chuẩn bị năm để bước nhiệm vụ (G3) chen vào giữa (§5.5 bước 5).
  const prepared: RunState = {
    ...state,
    year,
    phase: 'planning',
    army,
    played: false,
    offers: null,
    rerollsThisYear: 0,
    paidRerollsThisYear: 0,
    freeRerollsLeft: freeRerollsPerYear(state),
    idleUids: income.idleUids,
    gold: state.gold + RUN.taxPerYear + income.delta,
    stats: { ...state.stats, goldEarned: state.stats.goldEarned + gained },
    yearStartPendingDraw: true,
  };
  // Bước nhiệm vụ (chỉ ván đầy đủ) chen giữa thu nhập và rút bài (§5.5 bước 5).
  const offered = state.rules.calendar === 'full' ? offerQuest(prepared) : prepared;
  return offered.phase === 'quest' ? offered : finishYearStart(offered, content);
}

/** Mặc định `RULES_G1` cho tới khi G2c chuyển giao diện sang G2. */
export function newRun(
  seed: number,
  kingId: KingId,
  content: Content,
  rules: Rules = RULES_G1,
): RunState {
  const plots = initialPlots();
  plots[THRONE_PLOT]!.building = {
    uid: 0,
    cardId: content.king(kingId).throne.id,
    level: 1,
    enchants: [],
    placedYear: 1,
    permanent: {},
    ageBonus: 0,
    counters: {},
    movedYear: null,
  };
  const deck = rules.calendar === 'raiders' ? [...START_DECK_G1] : startDeck(content.king(kingId));
  const enemyKings = rules.calendar === 'raiders' ? [] : pickEnemyKings(seed, kingId, PLAYABLE_KINGS_G2);
  const base: RunState = {
    version: RUN_SAVE_VERSION,
    rules,
    seed,
    kingId,
    year: 0,
    phase: 'planning',
    lives: RUN.startLives,
    plots,
    throneLevel: 1,
    deck,
    hand: [],
    drawPile: [],
    discardPile: [...deck],
    autoFire: false,
    gold: RUN.startGold,
    rerollsThisYear: 0,
    paidRerollsThisYear: 0,
    purchasedPlots: 0,
    idleUids: [],
    enemyKings,
    pendingConquest: null,
    enemies: Object.fromEntries(enemyKings.map((k) => [k, { attacks: 0, status: 'pending' as const }])),
    played: false,
    army: null,
    offers: null,
    pendingOffers: [],
    decrees: [],
    quests: [],
    offeredQuestIds: [],
    freeRerollsLeft: 0,
    interventionDmgPct: 0,
    difficulty: 0,
    yearStartPendingDraw: false,
    rng: {
      draw: hashSeed(`${seed}:draw`),
      reward: hashSeed(`${seed}:reward`),
      calendar: hashSeed(`${seed}:calendar`),
      council: hashSeed(`${seed}:council`),
      quest: hashSeed(`${seed}:quest`),
    },
    stats: {
      kills: 0,
      battlesWon: 0,
      battlesLost: 0,
      goldEarned: 0,
      conquered: 0,
      bossesWon: 0,
      bossesDefeated: [],
      completedYears: 0,
    },
    nextUid: 1,
    won: null,
  };
  return startYear(base, content);
}
