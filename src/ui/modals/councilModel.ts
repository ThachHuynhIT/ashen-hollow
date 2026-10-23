/**
 * Pure model of the council and quest modals (spec §3.9, §7.1, §7.2): which modal a state
 * needs, what the chosen decree still has to pick, how a click changes the selection and which
 * command the UI sends. No Phaser, so every rule here is tested.
 */
import { DECREES } from '../../data/decrees';
import { QUESTS, QUEST_RULES } from '../../data/quests';
import { RUN } from '../../data/run';
import type { CardId } from '../../data/types';
import type { Content } from '../../game/cards/registry';
import { adjacentToUnlocked, unlockPlot } from '../../game/run/board';
import { MAX_PURGE, councilComplete, expandTarget, rarePool } from '../../game/run/council';
import type { CouncilSelection, OfferState, PlotState, QuestState, RunCommand, RunState } from '../../game/run/state';

export type ModalKind = 'council' | 'quest' | 'cards';

type CouncilOffer = Extract<OfferState, { kind: 'council' }>;

/** Which modal the state needs: the council, a quest offer, a card picker, or none. */
export const modalKind = (state: RunState): ModalKind | null => {
  const offer = state.offers;
  if (offer === null) return null;
  if (state.phase === 'council' && offer.kind === 'council') return 'council';
  if (state.phase === 'quest' && offer.kind === 'quest') return 'quest';
  if ((state.phase === 'reward' || state.phase === 'conquest') && 'cardIds' in offer) return 'cards';
  return null;
};

export const councilOffer = (state: RunState): CouncilOffer | null =>
  state.offers?.kind === 'council' ? state.offers : null;

/** What the selected decree still needs from the player (null = nothing). */
export type Subselection =
  | { kind: 'plots'; limit: number; picked: readonly number[]; eligible: readonly number[] }
  | { kind: 'card'; options: readonly CardId[]; picked: CardId | null }
  | { kind: 'deck'; limit: number; deck: readonly CardId[]; picked: readonly number[]; canPickMore: boolean };

const eligiblePlots = (plots: readonly PlotState[], picked: readonly number[]): number[] => {
  let board = plots;
  for (const p of picked) board = unlockPlot(board, p);
  return board.flatMap((p, i) => (!p.unlocked && adjacentToUnlocked(board, i) ? [i] : []));
};

export const subselection = (state: RunState, content: Content): Subselection | null => {
  const offer = councilOffer(state);
  if (offer === null || offer.selected === null) return null;
  const action = DECREES.find((d) => d.id === offer.selected)?.action;
  const sel = offer.selection;
  if (action === 'expand') {
    const limit = expandTarget(state);
    return { kind: 'plots', limit, picked: sel.plots, eligible: eligiblePlots(state.plots, sel.plots) };
  }
  if (action === 'academy') {
    return { kind: 'card', options: rarePool(state, content), picked: sel.cardId };
  }
  if (action === 'purge') {
    const room = state.deck.length - sel.deckIndices.length > RUN.handSize;
    return {
      kind: 'deck',
      limit: MAX_PURGE,
      deck: state.deck,
      picked: sel.deckIndices,
      canPickMore: sel.deckIndices.length < MAX_PURGE && room,
    };
  }
  return null;
};

const emptySelection = (): CouncilSelection => ({ plots: [], cardId: null, deckIndices: [] });

/**
 * The selection after a click. A plot toggles (and drops picks made after it, so the chain
 * stays adjacent), a card picks or unpicks, a deck index toggles; clicks past a limit or on an
 * ineligible target return the selection unchanged.
 */
export const toggleSubselection = (
  state: RunState,
  content: Content,
  pick: { plot: number } | { card: CardId } | { deckIndex: number },
): CouncilSelection => {
  const offer = councilOffer(state);
  const sub = subselection(state, content);
  const sel = offer?.selection ?? emptySelection();
  if (sub === null) return sel;
  if (sub.kind === 'plots' && 'plot' in pick) {
    const at = sel.plots.indexOf(pick.plot);
    if (at >= 0) return { ...sel, plots: sel.plots.slice(0, at) };
    if (sel.plots.length >= sub.limit || !sub.eligible.includes(pick.plot)) return sel;
    return { ...sel, plots: [...sel.plots, pick.plot] };
  }
  if (sub.kind === 'card' && 'card' in pick) {
    if (sel.cardId === pick.card) return { ...sel, cardId: null };
    return sub.options.includes(pick.card) ? { ...sel, cardId: pick.card } : sel;
  }
  if (sub.kind === 'deck' && 'deckIndex' in pick) {
    if (sel.deckIndices.includes(pick.deckIndex)) {
      return { ...sel, deckIndices: sel.deckIndices.filter((i) => i !== pick.deckIndex) };
    }
    if (!sub.canPickMore || state.deck[pick.deckIndex] === undefined) return sel;
    return { ...sel, deckIndices: [...sel.deckIndices, pick.deckIndex].sort((a, b) => a - b) };
  }
  return sel;
};

const sameSelection = (a: CouncilSelection, b: CouncilSelection): boolean =>
  a.cardId === b.cardId &&
  a.plots.length === b.plots.length &&
  a.plots.every((p, i) => p === b.plots[i]) &&
  a.deckIndices.length === b.deckIndices.length &&
  a.deckIndices.every((p, i) => p === b.deckIndices[i]);

/** The command that moves the council one step: store a changed selection, else enact. */
export const pendingCouncilIntent = (state: RunState, selection: CouncilSelection): RunCommand => {
  const stored = councilOffer(state)?.selection ?? emptySelection();
  return sameSelection(stored, selection)
    ? { type: 'enactDecree' }
    : { type: 'setCouncilSelection', selection };
};

/** "Ban hành" is enabled once a decree is chosen and its extra step is complete. */
export const canEnact = (state: RunState, content: Content): boolean => {
  const offer = councilOffer(state);
  if (offer === null || offer.selected === null) return false;
  const action = DECREES.find((d) => d.id === offer.selected)?.action ?? 'none';
  return councilComplete(state, action, offer.selection, content);
};

/** What the quest modal shows. */
export interface QuestOfferView {
  nameVi: string;
  textVi: string;
  rewardTextVi: string;
  duration: number;
  /** The last year the quest can still be completed. */
  deadlineYear: number;
  fee: number;
  canAccept: boolean;
}

export const questOfferView = (state: RunState): QuestOfferView | null => {
  const offer = state.offers;
  if (offer === null || offer.kind !== 'quest') return null;
  const def = QUESTS.find((q) => q.id === offer.questId);
  if (def === undefined) return null;
  return {
    nameVi: def.nameVi,
    textVi: def.textVi,
    rewardTextVi: def.rewardTextVi,
    duration: def.duration,
    deadlineYear: state.year + def.duration - 1,
    fee: def.acceptGold,
    canAccept: state.gold >= def.acceptGold,
  };
};

/** One chip of the purge picker: a card id of the deck, how many copies there are and how many are picked. */
export interface DeckGroup {
  cardId: CardId;
  indices: readonly number[];
  picked: number;
}

/** The deck grouped by card id (first appearance order), with how many copies are picked for purging. */
export const deckGroups = (state: RunState): DeckGroup[] => {
  const picked = councilOffer(state)?.selection.deckIndices ?? [];
  const order: CardId[] = [];
  const at = new Map<CardId, number[]>();
  state.deck.forEach((id, i) => {
    if (!at.has(id)) {
      at.set(id, []);
      order.push(id);
    }
    at.get(id)!.push(i);
  });
  return order.map((cardId) => {
    const indices = at.get(cardId)!;
    return { cardId, indices, picked: indices.filter((i) => picked.includes(i)).length };
  });
};

/**
 * A tap on a purge chip: one more copy of that card is picked while there is room, otherwise
 * one picked copy is put back (so a chip never gets stuck).
 */
export const toggleDeckCard = (state: RunState, content: Content, cardId: CardId): CouncilSelection => {
  const offer = councilOffer(state);
  const sel = offer?.selection ?? emptySelection();
  const group = deckGroups(state).find((g) => g.cardId === cardId);
  if (group === undefined) return sel;
  const free = group.indices.find((i) => !sel.deckIndices.includes(i));
  if (free !== undefined) {
    const next = toggleSubselection(state, content, { deckIndex: free });
    if (next !== sel && next.deckIndices.length > sel.deckIndices.length) return next;
  }
  const taken = [...group.indices].reverse().find((i) => sel.deckIndices.includes(i));
  return taken === undefined ? sel : toggleSubselection(state, content, { deckIndex: taken });
};

/** Extra progress words of the quests that count something (null = nothing to add). */
export const questProgressText = (quest: Pick<QuestState, 'id' | 'progress'>): string | null => {
  const p = quest.progress;
  switch (quest.id) {
    case 'quest_land_grab':
      return `Đã mở ${p.opened ?? 0}/${QUEST_RULES.opened} ô`;
    case 'quest_wager':
      return `Thắng liên tiếp ${p.winsInRow ?? 0}/${QUEST_RULES.wagerWins}`;
    case 'quest_no_reroll':
      return (p.rerolls ?? 0) > 0 ? 'Đã đổi bài — nhiệm vụ hỏng' : null;
    default:
      return null;
  }
};

/** Lines of the decrees-and-quests panel: decrees enacted, then the quests still running. */
export const decreeQuestLines = (state: RunState): string[] => {
  const lines: string[] = [];
  if (state.decrees.length > 0) {
    lines.push(`Sắc lệnh (${state.decrees.length})`);
    for (const id of state.decrees) {
      const def = DECREES.find((d) => d.id === id);
      if (def) lines.push(`• ${def.nameVi}: ${def.textVi}`);
    }
  }
  const active = state.quests.filter((q) => q.status === 'active');
  if (active.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push(`Nhiệm vụ (${active.length})`);
    for (const q of active) {
      const def = QUESTS.find((d) => d.id === q.id);
      if (!def) continue;
      lines.push(`• ${def.nameVi} — hạn hết năm ${q.deadlineYear}`, `  ${def.textVi}`);
      const progress = questProgressText(q);
      if (progress) lines.push(`  ${progress}`);
      lines.push(`  Thưởng: ${def.rewardTextVi}`);
    }
  }
  return lines;
};
