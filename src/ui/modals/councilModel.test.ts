import { describe, expect, it } from 'vitest';
import type { DecreeId, QuestId } from '../../data/types';
import { CONTENT } from '../../game/cards/registry';
import type { CouncilSelection, OfferState, RunState } from '../../game/run/state';
import { runState } from '../../game/testing/fixtures';
import {
  canEnact,
  deckGroups,
  decreeQuestLines,
  questProgressText,
  modalKind,
  pendingCouncilIntent,
  questOfferView,
  subselection,
  toggleDeckCard,
  toggleSubselection,
} from './councilModel';

const NONE: CouncilSelection = { plots: [], cardId: null, deckIndices: [] };
const IDS: DecreeId[] = ['decree_expand_borders', 'decree_academy', 'decree_purge'];

const council = (selected: DecreeId | null, selection: CouncilSelection = NONE, over: Partial<RunState> = {}): RunState =>
  runState({
    phase: 'council',
    offers: { kind: 'council', decreeIds: IDS, selected, selection },
    ...over,
  });

const quest = (questId: QuestId, gold: number, year = 7): RunState =>
  runState({ phase: 'quest', year, gold, offers: { kind: 'quest', questId } });

describe('modalKind', () => {
  it('maps every phase with an open offer to a modal, and anything else to none', () => {
    expect(modalKind(council(null))).toBe('council');
    expect(modalKind(quest('quest_wager', 5))).toBe('quest');
    const cards = (kind: 'reward' | 'conquest' | 'questReward', phase: RunState['phase']): RunState =>
      runState({ phase, offers: { kind, cardIds: [] } as OfferState });
    expect(modalKind(cards('reward', 'reward'))).toBe('cards');
    expect(modalKind(cards('conquest', 'conquest'))).toBe('cards');
    expect(modalKind(cards('questReward', 'reward'))).toBe('cards');
    expect(modalKind(runState())).toBeNull();
    expect(modalKind(runState({ phase: 'yearEnd' }))).toBeNull();
  });
});

describe('expand decree (2 plots)', () => {
  it('offers only locked plots next to open ones and builds a chain of two', () => {
    const s = council('decree_expand_borders');
    const sub = subselection(s, CONTENT);
    expect(sub?.kind).toBe('plots');
    if (sub?.kind !== 'plots') return;
    expect(sub.limit).toBe(2);
    expect(sub.eligible.length).toBeGreaterThan(0);
    const first = sub.eligible[0]!;
    const one = toggleSubselection(s, CONTENT, { plot: first });
    expect(one.plots).toEqual([first]);
    expect(canEnact(council('decree_expand_borders', one), CONTENT)).toBe(false); // 1 of 2
    const afterOne = council('decree_expand_borders', one);
    const sub2 = subselection(afterOne, CONTENT);
    const second = sub2?.kind === 'plots' ? sub2.eligible.find((p) => p !== first)! : -1;
    const two = toggleSubselection(afterOne, CONTENT, { plot: second });
    expect(two.plots).toEqual([first, second]);
    expect(canEnact(council('decree_expand_borders', two), CONTENT)).toBe(true);
  });

  it('a third plot or an ineligible plot changes nothing; tapping a picked plot drops it and later ones', () => {
    const s0 = council('decree_expand_borders');
    const sub = subselection(s0, CONTENT);
    if (sub?.kind !== 'plots') throw new Error('plots');
    const a = sub.eligible[0]!;
    const s1 = council('decree_expand_borders', toggleSubselection(s0, CONTENT, { plot: a }));
    const sub1 = subselection(s1, CONTENT);
    const b = sub1?.kind === 'plots' ? sub1.eligible.find((p) => p !== a)! : -1;
    const s2 = council('decree_expand_borders', toggleSubselection(s1, CONTENT, { plot: b }));
    const third = sub.eligible.find((p) => p !== a && p !== b)!;
    expect(toggleSubselection(s2, CONTENT, { plot: third }).plots).toEqual([a, b]); // over the limit
    expect(toggleSubselection(s2, CONTENT, { plot: 12 }).plots).toEqual([a, b]); // the throne is open
    expect(toggleSubselection(s2, CONTENT, { plot: a }).plots).toEqual([]);
  });

  it('with no locked plot left there is nothing to choose and Ban hành is open at once', () => {
    const open = runState();
    const all = { ...open, plots: open.plots.map((p) => ({ ...p, unlocked: true })) };
    const s = { ...all, phase: 'council' as const, offers: { kind: 'council', decreeIds: IDS, selected: 'decree_expand_borders', selection: NONE } as OfferState };
    expect(canEnact(s, CONTENT)).toBe(true);
  });
});

describe('academy decree (a rare card)', () => {
  it('lists the king rare cards, picks one, unpicks it, and needs one to enact', () => {
    const s = council('decree_academy');
    const sub = subselection(s, CONTENT);
    expect(sub?.kind).toBe('card');
    if (sub?.kind !== 'card') return;
    expect(sub.options.length).toBe(2); // Wheat has two rare cards
    expect(canEnact(s, CONTENT)).toBe(false);
    const card = sub.options[0]!;
    const picked = toggleSubselection(s, CONTENT, { card });
    expect(picked.cardId).toBe(card);
    expect(canEnact(council('decree_academy', picked), CONTENT)).toBe(true);
    expect(toggleSubselection(council('decree_academy', picked), CONTENT, { card }).cardId).toBeNull();
    expect(toggleSubselection(s, CONTENT, { card: 'neutral_move' as never }).cardId).toBeNull();
  });
});

describe('purge decree (0 to 2 cards)', () => {
  it('toggles up to two deck occurrences and is always allowed to enact', () => {
    const s = council('decree_purge');
    expect(canEnact(s, CONTENT)).toBe(true); // purging nothing is allowed
    const a = toggleSubselection(s, CONTENT, { deckIndex: 3 });
    expect(a.deckIndices).toEqual([3]);
    const s1 = council('decree_purge', a);
    const b = toggleSubselection(s1, CONTENT, { deckIndex: 1 });
    expect(b.deckIndices).toEqual([1, 3]);
    const s2 = council('decree_purge', b);
    expect(toggleSubselection(s2, CONTENT, { deckIndex: 5 }).deckIndices).toEqual([1, 3]); // limit 2
    expect(toggleSubselection(s2, CONTENT, { deckIndex: 3 }).deckIndices).toEqual([1]);
    const sub = subselection(s2, CONTENT);
    expect(sub?.kind === 'deck' && sub.canPickMore).toBe(false);
  });

  it('does not let the deck fall under the hand size', () => {
    const base = council('decree_purge');
    const s = { ...base, deck: base.deck.slice(0, 4) };
    const one = toggleSubselection(s, CONTENT, { deckIndex: 0 });
    expect(one.deckIndices).toEqual([0]);
    expect(toggleSubselection(council('decree_purge', one, { deck: s.deck }), CONTENT, { deckIndex: 1 }).deckIndices).toEqual([0]);
  });
});

describe('plain decrees', () => {
  it('have no extra step; Ban hành needs a decree first', () => {
    expect(canEnact(council(null), CONTENT)).toBe(false);
    const plain = runState({
      phase: 'council',
      offers: { kind: 'council', decreeIds: ['decree_mobilize', 'decree_treasury', 'decree_moat'], selected: 'decree_mobilize', selection: NONE },
    });
    expect(subselection(plain, CONTENT)).toBeNull();
    expect(canEnact(plain, CONTENT)).toBe(true);
  });
});

describe('pendingCouncilIntent', () => {
  it('stores a changed selection first, and enacts when nothing changed', () => {
    const s = council('decree_academy');
    const sub = subselection(s, CONTENT);
    const card = (sub?.kind === 'card' ? sub.options[0] : null) as never;
    const changed: CouncilSelection = { plots: [], cardId: card, deckIndices: [] };
    expect(pendingCouncilIntent(s, changed)).toEqual({ type: 'setCouncilSelection', selection: changed });
    expect(pendingCouncilIntent(council('decree_academy', changed), changed)).toEqual({ type: 'enactDecree' });
    expect(pendingCouncilIntent(s, NONE)).toEqual({ type: 'enactDecree' });
  });
});

describe('questOfferView', () => {
  it('shows condition, deadline, reward and fee', () => {
    const v = questOfferView(quest('quest_three_barracks', 0, 7))!;
    expect(v.nameVi).toBe('Ba Doanh Trại');
    expect(v.textVi).toContain('3 công trình lính');
    expect(v.duration).toBe(3);
    expect(v.deadlineYear).toBe(9);
    expect(v.rewardTextVi).toContain('thẻ hiếm');
    expect(v.fee).toBe(0);
    expect(v.canAccept).toBe(true);
  });

  it('wager costs 5 gold: 4 gold cannot accept, 5 can', () => {
    expect(questOfferView(quest('quest_wager', 4))!.canAccept).toBe(false);
    expect(questOfferView(quest('quest_wager', 5))!.canAccept).toBe(true);
    expect(questOfferView(quest('quest_wager', 5))!.fee).toBe(5);
  });

  it('is null when no quest is offered', () => {
    expect(questOfferView(runState())).toBeNull();
  });
});

describe('purge chips', () => {
  it('groups the deck by card with copy counts', () => {
    const s = council('decree_purge');
    const groups = deckGroups(s);
    expect(groups.reduce((n, g) => n + g.indices.length, 0)).toBe(s.deck.length);
    expect(new Set(groups.map((g) => g.cardId)).size).toBe(groups.length);
    expect(groups.every((g) => g.picked === 0)).toBe(true);
  });

  it('tapping a chip picks one more copy until the limit, then puts one back', () => {
    const base = council('decree_purge');
    const dup = deckGroups(base).find((g) => g.indices.length >= 2)!;
    const card = dup.cardId;
    const one = toggleDeckCard(base, CONTENT, card);
    expect(one.deckIndices).toEqual([dup.indices[0]]);
    const s1 = council('decree_purge', one);
    const two = toggleDeckCard(s1, CONTENT, card);
    expect(two.deckIndices).toEqual([dup.indices[0], dup.indices[1]]);
    const s2 = council('decree_purge', two);
    expect(deckGroups(s2).find((g) => g.cardId === card)!.picked).toBe(2);
    // at the limit of two: the next tap on a picked card returns one copy
    expect(toggleDeckCard(s2, CONTENT, card).deckIndices).toEqual([dup.indices[0]]);
    // another card cannot be picked at the limit
    const other = deckGroups(s2).find((g) => g.cardId !== card)!.cardId;
    expect(toggleDeckCard(s2, CONTENT, other).deckIndices).toEqual(two.deckIndices);
  });
});

describe('decreeQuestLines / questProgressText', () => {
  it('is empty before any decree or quest', () => {
    expect(decreeQuestLines(runState())).toEqual([]);
  });

  it('lists the enacted decrees and the active quests with deadline and reward', () => {
    const s = runState({
      decrees: ['decree_mobilize'],
      quests: [
        { id: 'quest_land_grab', offeredYear: 3, deadlineYear: 5, status: 'active', progress: { opened: 1 } },
        { id: 'quest_untouched', offeredYear: 3, deadlineYear: 3, status: 'completed', progress: {} },
      ],
    });
    const lines = decreeQuestLines(s);
    expect(lines[0]).toBe('Sắc lệnh (1)');
    expect(lines[1]).toContain('Tổng Động Viên');
    expect(lines).toContain('Nhiệm vụ (1)');
    expect(lines.join(' | ')).toContain('Khai Phá — hạn hết năm 5');
    expect(lines.join(' | ')).toContain('Đã mở 1/2 ô');
    expect(lines.join(' | ')).not.toContain('Ngai Vô Sự'); // completed quests are not listed
  });

  it('reports progress only for counting quests', () => {
    expect(questProgressText({ id: 'quest_wager', progress: { winsInRow: 1 } })).toBe('Thắng liên tiếp 1/2');
    expect(questProgressText({ id: 'quest_no_reroll', progress: { rerolls: 0 } })).toBeNull();
    expect(questProgressText({ id: 'quest_no_reroll', progress: { rerolls: 1 } })).toContain('hỏng');
    expect(questProgressText({ id: 'quest_blitz', progress: {} })).toBeNull();
  });
});
