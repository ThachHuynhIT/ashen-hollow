import { describe, expect, it } from 'vitest';
import type { CardId } from '../../data/types';
import { CONTENT } from '../../game/cards/registry';
import { DECK_TABS, deckEntries, type DeckTab } from './deckModel';

describe('deckEntries', () => {
  const deck: CardId[] = [
    'wheat_militia',
    'wheat_militia',
    'wheat_scarecrow',
    'neutral_sharpen',
    'neutral_sharpen',
    'neutral_sharpen',
    'neutral_clear_land',
  ];

  it('counts copies of each card, in a stable order', () => {
    const all = deckEntries(deck, CONTENT, 'all');
    expect(all.find((e) => e.cardId === 'wheat_militia')!.count).toBe(2);
    expect(all.find((e) => e.cardId === 'neutral_sharpen')!.count).toBe(3);
    expect(all.reduce((n, e) => n + e.count, 0)).toBe(deck.length);
    expect(deckEntries([...deck].reverse(), CONTENT, 'all')).toEqual(all);
  });

  it('filters by card kind', () => {
    const ids = (tab: DeckTab) => deckEntries(deck, CONTENT, tab).map((e) => e.cardId);
    expect(ids('buildings')).toEqual(expect.arrayContaining(['wheat_militia', 'wheat_scarecrow']));
    expect(ids('buildings')).not.toContain('neutral_sharpen');
    expect(ids('enchantments')).toEqual(['neutral_sharpen']);
    expect(ids('tomes')).toEqual(['neutral_clear_land']);
  });

  it('has one tab id per layout tab', () => {
    expect(DECK_TABS.map((t) => t.id)).toEqual(['all', 'buildings', 'enchantments', 'tomes']);
    expect(DECK_TABS.every((t) => t.label.length > 0)).toBe(true);
  });
});
