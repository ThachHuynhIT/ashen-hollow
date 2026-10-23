import { describe, expect, it } from 'vitest';
import { BOSSES } from '../../data/bosses';
import { DECREES, decreeText } from '../../data/decrees';
import { HELP_TABS } from '../../data/help';
import { QUESTS } from '../../data/quests';
import { SHORTCUTS } from '../../data/shortcuts';
import type { CardDef, Level } from '../../data/types';
import { describeCard } from '../../game/cards/describe';
import { CONTENT } from '../../game/cards/registry';
import { buildHelpCatalog, helpCards, type HelpFilter } from './helpModel';

const ALL: HelpFilter = { owner: 'all', kind: 'all', rarity: 'all', level: 1 };

describe('catalog_covers_live_content', () => {
  const catalog = buildHelpCatalog(CONTENT);

  it('has every tab, in the declared order', () => {
    expect(Object.keys(catalog.tabs).sort()).toEqual(HELP_TABS.map((t) => t.id).sort());
    for (const t of HELP_TABS) expect(catalog.tabs[t.id].length, t.id).toBeGreaterThan(0);
  });

  it('lists every registered card once, with 9 non-throne cards for each of the 9 kings', () => {
    const ids = catalog.tabs.cards.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(CONTENT.allCards().map((c) => c.id).sort());
    for (const king of CONTENT.enemyKings()) {
      const owned = CONTENT.allCards().filter((c) => c.owner === king.id && c.kind !== 'throne');
      expect(owned.length, king.id).toBe(9);
    }
    const thrones = CONTENT.allCards().filter((c) => c.kind === 'throne');
    expect(thrones.length).toBe(CONTENT.kings().length); // no invented thrones for unplayable kings
  });

  it('lists every unit, decree, quest, boss and banner', () => {
    expect(catalog.tabs.units.map((e) => e.id).sort()).toEqual(CONTENT.allUnits().map((u) => u.id).sort());
    expect(catalog.tabs.decrees).toHaveLength(DECREES.length);
    expect(catalog.tabs.quests).toHaveLength(QUESTS.length);
    expect(catalog.tabs.bosses).toHaveLength(BOSSES.length);
    expect(catalog.tabs.banners).toHaveLength(CONTENT.enemyKings().length);
    expect(DECREES).toHaveLength(18);
    expect(QUESTS).toHaveLength(13);
  });

  it('owners are neutral plus every one of the nine kings', () => {
    expect(catalog.owners.map((o) => o.id)).toEqual(['neutral', ...CONTENT.enemyKings().map((k) => k.id)]);
  });

  it('every entry has a title and Vietnamese lines with no unresolved placeholder', () => {
    for (const tab of Object.values(catalog.tabs)) {
      for (const e of tab) {
        expect(e.title.length, e.id).toBeGreaterThan(0);
        expect(e.lines.length, e.id).toBeGreaterThan(0);
        for (const line of e.lines) {
          expect(line, e.id).not.toMatch(/\{\w+\}/);
          expect(line, e.id).not.toContain('undefined');
          expect(line, e.id).not.toContain('NaN');
        }
      }
    }
  });

  it('the shortcuts tab shows every binding of the table', () => {
    const text = catalog.tabs.shortcuts.flatMap((e) => e.lines).join('\n');
    for (const d of SHORTCUTS) expect(text, d.id).toContain(d.labelVi);
  });
});

describe('cards_use_describe_card_at_level', () => {
  it('L1 and L5 lines are exactly describeCard for the same CardDef', () => {
    for (const level of [1, 5] as Level[]) {
      for (const entry of buildHelpCatalog(CONTENT, level).tabs.cards) {
        const def = CONTENT.card(entry.id as CardDef['id']);
        expect(entry.lines, `${entry.id} L${level}`).toEqual(describeCard(def, level).lines);
      }
    }
  });

  it('filters by owner, kind and rarity as an intersection, sorted by id with no duplicates', () => {
    const stoneTowers = helpCards(CONTENT, { ...ALL, owner: 'stone', kind: 'tower' });
    expect(stoneTowers.length).toBeGreaterThan(0);
    for (const e of stoneTowers) {
      const def = CONTENT.card(e.id as CardDef['id']);
      expect([def.owner, def.kind]).toEqual(['stone', 'tower']);
    }
    const ids = stoneTowers.map((e) => e.id);
    expect(ids).toEqual([...ids].sort());
    const rare = helpCards(CONTENT, { ...ALL, owner: 'stone', kind: 'tower', rarity: 'rare' });
    expect(rare.every((e) => stoneTowers.some((s) => s.id === e.id))).toBe(true);
    expect(helpCards(CONTENT, { ...ALL, owner: 'neutral', kind: 'throne' })).toEqual([]);
  });

  it('shows a decree text from the live rules', () => {
    const entry = buildHelpCatalog(CONTENT).tabs.decrees.find((e) => e.id === 'decree_fourth_hand')!;
    expect(entry.lines).toContain(decreeText(DECREES.find((d) => d.id === 'decree_fourth_hand')!));
  });
});
