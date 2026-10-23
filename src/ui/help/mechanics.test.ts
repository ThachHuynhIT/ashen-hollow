import { afterEach, describe, expect, it, vi } from 'vitest';
import { BATTLE } from '../../data/battle';
import { RUN } from '../../data/run';
import { CONTENT } from '../../game/cards/registry';
import type * as BossesModule from '../../data/bosses';
import type * as DecreesModule from '../../data/decrees';
import type * as QuestsModule from '../../data/quests';
import type * as RunModule from '../../data/run';
import { mechanicEntries } from './mechanics';

const text = (entries: readonly { title: string; lines: readonly string[] }[]): string =>
  entries.map((e) => `${e.title}\n${e.lines.join('\n')}`).join('\n');

describe('mechanicEntries', () => {
  const entries = mechanicEntries(CONTENT);
  const all = text(entries);

  it('covers every mandatory mechanic', () => {
    const titles = entries.map((e) => e.title).join('|');
    for (const topic of [
      'Một năm',
      'Vàng',
      'Cấp',
      'Chinh phục',
      'Liên Quân',
      'Hội đồng',
      'Nhiệm vụ',
      'Boss',
      'Lưu ván',
      'Thắng và thua',
    ]) {
      expect(titles, topic).toContain(topic);
    }
  });

  it('reads the rule numbers from data instead of typing them again', () => {
    expect(all).toContain(`${RUN.taxPerYear} vàng`);
    expect(all).toContain(RUN.councilYears.join(', '));
    expect(all).toContain(RUN.questYears.join(', '));
    expect(all).toContain(RUN.bossYears.join(', '));
    expect(all).toContain(`${BATTLE.hardLimitTick} tick`);
  });

  it('states the win condition for the 900-tick limit and the boss kill', () => {
    const win = text(entries.filter((e) => e.title.includes('Thắng và thua')));
    expect(win).toContain('Vương Miện Vàng');
    expect(win).toContain('hạ');
  });

  it('has no unresolved placeholder or NaN', () => {
    expect(all).not.toMatch(/\{\w+\}|NaN|undefined/);
  });
});

describe('help_reacts_to_balance_changes', () => {
  afterEach(() => {
    vi.doUnmock('../../data/run');
    vi.doUnmock('../../data/quests');
    vi.doUnmock('../../data/decrees');
    vi.doUnmock('../../data/bosses');
    vi.resetModules();
  });

  it('shows changed run, quest, decree and boss numbers and no longer the old ones', async () => {
    vi.resetModules();
    vi.doMock('../../data/run', async (orig) => {
      const m = await orig<typeof RunModule>();
      return { ...m, RUN: { ...m.RUN, taxPerYear: 71 } };
    });
    vi.doMock('../../data/quests', async (orig) => {
      const m = await orig<typeof QuestsModule>();
      return { ...m, QUEST_RULES: { ...m.QUEST_RULES, wagerFee: 93 } };
    });
    vi.doMock('../../data/decrees', async (orig) => {
      const m = await orig<typeof DecreesModule>();
      return { ...m, DECREE_RULES: { ...m.DECREE_RULES, reward: 77 } };
    });
    vi.doMock('../../data/bosses', async (orig) => {
      const m = await orig<typeof BossesModule>();
      return { ...m, BOSS_RULES: { ...m.BOSS_RULES, bog: { ...m.BOSS_RULES.bog, mudRange: 987 } } };
    });
    const { CONTENT: content } = await import('../../game/cards/registry');
    const { buildHelpCatalog } = await import('./helpModel');
    const catalog = buildHelpCatalog(content);
    const mech = text(catalog.tabs.mechanics);
    expect(mech).toContain('71 vàng');
    expect(mech).not.toContain(`${RUN.taxPerYear} vàng mỗi năm`);
    const quests = text(catalog.tabs.quests);
    expect(quests).toContain('93 vàng');
    const decrees = text(catalog.tabs.decrees);
    expect(decrees).toContain('77 lựa chọn');
    expect(decrees).not.toContain('4 lựa chọn');
    const bosses = text(catalog.tabs.bosses);
    expect(bosses).toContain('987');
    expect(bosses).not.toContain('160 px');
  });
});
