/** Khởi tạo ván và bước sang năm mới (spec §3.2, §5.5 bước 1, 6). Thuần, không sửa đầu vào. */
import { Rng, hashSeed } from '../../core/random';
import { SLOT_MULT } from '../../data/battle';
import { RUN, START_DECK_G1 } from '../../data/run';
import type { KingId } from '../../data/types';
import { armyBudget, composeArmy } from '../battle/compose';
import type { Content } from '../cards/registry';
import { THRONE_PLOT, initialPlots } from './board';
import { refillHand } from './deck';
import { RUN_SAVE_VERSION } from './state';
import type { RunState } from './state';

/** Sang năm kế: bốc đạo quân và rút tay mới, về pha lập kế hoạch. */
export function startYear(state: RunState, content: Content): RunState {
  const year = state.year + 1;
  const roster = content.raiderRoster().map((r) => ({
    unit: r.unit.id,
    weight: r.weight,
    enemyCost: r.unit.enemyCost,
  }));
  const army = composeArmy(roster, armyBudget(year, SLOT_MULT.raiders), year, state.seed);
  const rng = new Rng(state.rng.draw);
  const piles = refillHand(state.hand, state.drawPile, state.discardPile, rng, RUN.handSize);
  return {
    ...state,
    year,
    phase: 'planning',
    army,
    ...piles,
    played: false,
    offers: null,
    rng: { ...state.rng, draw: rng.getState() },
  };
}

export function newRun(seed: number, kingId: KingId, content: Content): RunState {
  const plots = initialPlots();
  plots[THRONE_PLOT]!.building = {
    uid: 0,
    cardId: content.king(kingId).throne.id,
    level: 1,
    placedYear: 1,
  };
  const base: RunState = {
    version: RUN_SAVE_VERSION,
    seed,
    kingId,
    year: 0,
    phase: 'planning',
    lives: RUN.startLives,
    plots,
    throneLevel: 1,
    deck: [...START_DECK_G1],
    hand: [],
    drawPile: [],
    discardPile: [...START_DECK_G1],
    autoFire: false,
    played: false,
    army: null,
    offers: null,
    rng: { draw: hashSeed(`${seed}:draw`), reward: hashSeed(`${seed}:reward`) },
    stats: { kills: 0, battlesWon: 0, battlesLost: 0 },
    nextUid: 1,
    won: null,
  };
  return startYear(base, content);
}
