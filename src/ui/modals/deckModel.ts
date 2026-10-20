import type { CardDef, CardId } from '../../data/types';
import type { Content } from '../../game/cards/registry';

export type DeckTab = 'all' | 'buildings' | 'enchantments' | 'tomes';

export const DECK_TABS: readonly { id: DeckTab; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'buildings', label: 'Công trình' },
  { id: 'enchantments', label: 'Bùa' },
  { id: 'tomes', label: 'Sách' },
];

const TAB_OF: Record<CardDef['kind'], DeckTab> = {
  throne: 'buildings',
  troop: 'buildings',
  tower: 'buildings',
  economy: 'buildings',
  support: 'buildings',
  enchantment: 'enchantments',
  tome: 'tomes',
};

export interface DeckEntry {
  cardId: CardId;
  count: number;
}

/** The deck grouped by card (with a copy count), filtered by tab, sorted by card id. */
export const deckEntries = (deck: readonly CardId[], content: Content, tab: DeckTab): DeckEntry[] => {
  const counts = new Map<CardId, number>();
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.keys()]
    .sort()
    .filter((id) => tab === 'all' || TAB_OF[content.card(id).kind] === tab)
    .map((cardId) => ({ cardId, count: counts.get(cardId)! }));
};
