/**
 * Hội đồng hoàng gia (spec §3.9, §7.1): bốc 3 sắc lệnh, chọn một, làm bước chọn phụ rồi ban hành.
 * Mọi bước là giao dịch: lệnh sai trả `IllegalReason` và không đổi gì (kể cả RNG); sắc lệnh chỉ
 * áp một lần ở `enactDecree`. Thuần, không sửa đầu vào.
 */
import { Rng } from '../../core/random';
import { DECREES } from '../../data/decrees';
import { RUN } from '../../data/run';
import type { CardId } from '../../data/types';
import type { Content } from '../cards/registry';
import { THRONE_PLOT, adjacentToUnlocked, attachEnchant, unlockPlot } from './board';
import { decree } from './decrees';
import { closeOffer, enqueueOffers } from './flow';
import type { CouncilSelection, IllegalReason, OfferState, PlotState, RunState } from './state';

type CouncilOffer = Extract<OfferState, { kind: 'council' }>;

const PLOTS = 25;
const PICKS = 3;
const MAX_EXPAND = 2;
const MAX_PURGE = 2;
const TREASURY_GOLD = 15;
const AMNESTY_GOLD = 10;

const emptySelection = (): CouncilSelection => ({ plots: [], cardId: null, deckIndices: [] });

/** Bước hội đồng đang mở (đúng pha), nếu có. */
const openCouncil = (state: RunState): CouncilOffer | null =>
  state.phase === 'council' && state.offers?.kind === 'council' ? state.offers : null;

const withOffer = (state: RunState, offer: CouncilOffer): RunState => ({ ...state, offers: offer });

/** Xếp bước hội đồng với 3 sắc lệnh chưa có, bốc bằng `Rng(stream 'council')` (Fisher–Yates). */
export function rollCouncil(state: RunState): RunState {
  const pool = DECREES.map((d) => d.id).filter((id) => !state.decrees.includes(id));
  const rng = new Rng(state.rng.council);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  const offer: CouncilOffer = {
    kind: 'council',
    decreeIds: pool.slice(0, PICKS),
    selected: null,
    selection: emptySelection(),
  };
  return enqueueOffers({ ...state, rng: { ...state.rng, council: rng.getState() } }, [offer]);
}

/** Ghi sắc lệnh đang chọn (chưa áp gì); đổi lựa chọn thì bỏ phần chọn phụ cũ. */
export function selectDecree(state: RunState, index: number): RunState | IllegalReason {
  const offer = openCouncil(state);
  if (offer === null) return 'wrongPhase';
  const id = Number.isInteger(index) ? offer.decreeIds[index] : undefined;
  if (id === undefined) return 'badTarget';
  return withOffer(state, { ...offer, selected: id, selection: emptySelection() });
}

/** Thẻ hiếm của vua người chơi (Học Viện Hoàng Gia). */
const rarePool = (state: RunState, content: Content): CardId[] =>
  content
    .king(state.kingId)
    .cards.filter((c) => c.rarity === 'rare')
    .map((c) => c.id);

/** Số ô phải mở: 2, hoặc ít hơn nếu bàn cờ còn ít ô khoá (đầy thì 0). */
const expandTarget = (state: RunState): number =>
  Math.min(MAX_EXPAND, state.plots.filter((p) => !p.unlocked).length);

/** Chuẩn hoá và kiểm một phần chọn phụ; `null` nếu có bất kỳ phần nào sai. */
function validate(
  state: RunState,
  action: ReturnType<typeof decree>['action'],
  sel: CouncilSelection,
  content: Content,
): CouncilSelection | null {
  const out = emptySelection();
  const only = (...used: ('plots' | 'cardId' | 'deckIndices')[]): boolean =>
    (['plots', 'cardId', 'deckIndices'] as const).every((k) => used.includes(k) || isEmpty(sel, k));

  if (action === 'expand') {
    if (!only('plots') || sel.plots.length > expandTarget(state)) return null;
    let plots: readonly PlotState[] = state.plots;
    for (const plot of sel.plots) {
      if (!Number.isInteger(plot) || plot < 0 || plot >= PLOTS) return null;
      if (plots[plot]!.unlocked || !adjacentToUnlocked(plots, plot)) return null;
      plots = unlockPlot(plots, plot);
      out.plots.push(plot);
    }
    return out;
  }
  if (action === 'academy') {
    if (!only('cardId')) return null;
    if (sel.cardId !== null && !rarePool(state, content).includes(sel.cardId)) return null;
    out.cardId = sel.cardId;
    return out;
  }
  if (action === 'purge') {
    if (!only('deckIndices') || sel.deckIndices.length > MAX_PURGE) return null;
    const idx = [...sel.deckIndices].sort((a, b) => a - b);
    for (let i = 0; i < idx.length; i++) {
      const v = idx[i]!;
      if (!Number.isInteger(v) || v < 0 || v >= state.deck.length || v === idx[i - 1]) return null;
    }
    if (state.deck.length - idx.length < RUN.handSize) return null;
    out.deckIndices = idx;
    return out;
  }
  return only() ? out : null;
}

const isEmpty = (sel: CouncilSelection, key: 'plots' | 'cardId' | 'deckIndices'): boolean =>
  key === 'cardId' ? sel.cardId === null : sel[key].length === 0;

/** Lưu phần chọn phụ đã kiểm cho sắc lệnh đang chọn (có thể chưa đủ bước). */
export function setCouncilSelection(
  state: RunState,
  selection: CouncilSelection,
  content: Content,
): RunState | IllegalReason {
  const offer = openCouncil(state);
  if (offer === null) return 'wrongPhase';
  if (offer.selected === null) return 'badTarget';
  const clean = validate(state, decree(offer.selected).action, selection, content);
  if (clean === null) return 'badTarget';
  return withOffer(state, { ...offer, selection: clean });
}

/** Đủ bước chọn phụ để ban hành? Không có đích hợp lệ nào thì coi như đủ (xác nhận không-op). */
const complete = (state: RunState, action: string, sel: CouncilSelection, content: Content): boolean => {
  if (action === 'expand') return sel.plots.length === expandTarget(state);
  if (action === 'academy') return sel.cardId !== null || rarePool(state, content).length === 0;
  return true;
};

/** Bỏ một bản của `card` ở tay, rồi chồng rút, rồi chồng bỏ (theo thứ tự đó). */
function removeOne(
  piles: { hand: CardId[]; drawPile: CardId[]; discardPile: CardId[] },
  card: CardId,
): void {
  for (const pile of [piles.hand, piles.drawPile, piles.discardPile]) {
    const at = pile.indexOf(card);
    if (at >= 0) {
      pile.splice(at, 1);
      return;
    }
  }
}

/** Áp hiệu ứng tức thời của sắc lệnh lên bản sao `s`. */
function apply(s: RunState, action: string, sel: CouncilSelection): void {
  const earn = (gold: number): void => {
    s.gold += gold;
    s.stats.goldEarned += gold;
  };
  switch (action) {
    case 'crown': {
      s.throneLevel = Math.min(RUN.maxLevel, s.throneLevel + 1) as RunState['throneLevel'];
      s.plots[THRONE_PLOT]!.building!.level = s.throneLevel;
      break;
    }
    case 'treasury':
      earn(TREASURY_GOLD);
      break;
    case 'amnesty':
      if (s.lives < RUN.maxLives) s.lives += 1;
      else earn(AMNESTY_GOLD);
      break;
    case 'runeFestival': {
      s.plots.forEach((p, plot) => {
        const first = p.building?.enchants[0];
        if (first) s.plots = attachEnchant(s.plots, plot, first.cardId, RUN.maxEnchantStacks);
      });
      break;
    }
    case 'expand':
      for (const plot of sel.plots) s.plots = unlockPlot(s.plots, plot);
      break;
    case 'academy':
      if (sel.cardId !== null) {
        s.deck.push(sel.cardId);
        s.drawPile.unshift(sel.cardId);
      }
      break;
    case 'purge': {
      const gone = sel.deckIndices.map((i) => s.deck[i]!);
      s.deck = s.deck.filter((_, i) => !sel.deckIndices.includes(i));
      for (const card of gone) removeOne(s, card);
      break;
    }
  }
}

/** Ban hành sắc lệnh đang chọn một lần, rồi mở bước kế trong hàng đợi (hoặc về `yearEnd`). */
export function enactDecree(state: RunState, content: Content): RunState | IllegalReason {
  const offer = openCouncil(state);
  if (offer === null) return 'wrongPhase';
  if (offer.selected === null) return 'badTarget';
  const def = decree(offer.selected);
  if (!complete(state, def.action, offer.selection, content)) return 'badTarget';
  const next = structuredClone(state);
  apply(next, def.action, offer.selection);
  next.decrees.push(def.id);
  return closeOffer(next);
}
