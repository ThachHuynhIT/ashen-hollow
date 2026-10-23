/** Danh mục Trợ giúp sống từ registry và số liệu luật (thuần; không chép nội dung thẻ/lính vào đây). */
import { BOSSES } from '../../data/bosses';
import { DECREES, DECREE_RULES, decreeText } from '../../data/decrees';
import { HELP_TABS, type HelpTab } from '../../data/help';
import { RUN } from '../../data/run';
import { QUESTS, QUEST_RULES, questRewardText, questText } from '../../data/quests';
import { SHORTCUTS, type ShortcutContext } from '../../data/shortcuts';
import type { CardKind, KingId, Level, Rarity, UnitDef } from '../../data/types';
import type { Content } from '../../game/cards/registry';
import { describeCard } from '../../game/cards/describe';
import { cardArtFrame } from '../../render/atlas';
import { behaviourLabel, damageTypeLabel, unitTagLabel } from '../info/labels';
import { shortcutLabel } from '../input/shortcuts';
import { bossSkillLines, mechanicEntries } from './mechanics';

export interface HelpFilter {
  readonly owner: KingId | 'neutral' | 'all';
  readonly kind: CardKind | 'all';
  readonly rarity: Rarity | 'all';
  readonly level: Level;
}

export interface HelpEntry {
  readonly id: string;
  readonly title: string;
  readonly lines: readonly string[];
  /** Tên frame tranh trong atlas thế giới, nếu có. */
  readonly frame: string | null;
}

export interface HelpCatalog {
  readonly tabs: Readonly<Record<HelpTab, readonly HelpEntry[]>>;
  readonly owners: readonly { readonly id: KingId | 'neutral'; readonly nameVi: string }[];
}

export const DEFAULT_HELP_FILTER: HelpFilter = { owner: 'all', kind: 'all', rarity: 'all', level: 1 };

const byId = <T extends { readonly id: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** Các thẻ khớp bộ lọc (giao của owner, kind, rarity), sắp theo id, mô tả ở cấp `filter.level`. */
export const helpCards = (content: Content, filter: HelpFilter): readonly HelpEntry[] =>
  byId(
    content
      .allCards()
      .filter(
        (c) =>
          (filter.owner === 'all' || c.owner === filter.owner) &&
          (filter.kind === 'all' || c.kind === filter.kind) &&
          (filter.rarity === 'all' || c.rarity === filter.rarity),
      ),
  ).map((def) => ({
    id: def.id,
    title: def.nameVi,
    lines: describeCard(def, filter.level).lines,
    frame: cardArtFrame(def.id),
  }));

const unitLines = (u: UnitDef): string[] => {
  const a = u.attack;
  return [
    `Máu ${u.hp} · Giáp ${Math.round(u.armor * 100)}%`,
    `Sát thương ${a.dmg} (${damageTypeLabel(a.type)}) · Tầm ${a.range}`,
    ...(u.tags.length > 0 ? [`Loại: ${u.tags.map(unitTagLabel).join(', ')}`] : []),
    ...(u.behaviours ?? []).filter((b) => b.type !== 'boss').map(behaviourLabel),
  ];
};

const CONTEXT_NAMES: Record<ShortcutContext, string> = {
  menu: 'Menu',
  kingSelect: 'Chọn vua',
  planning: 'Lên kế hoạch',
  battle: 'Trong trận',
  runEnd: 'Kết thúc ván',
  help: 'Trợ giúp',
};

const shortcutEntries = (): HelpEntry[] =>
  (Object.keys(CONTEXT_NAMES) as ShortcutContext[]).flatMap((ctx) => {
    const defs = SHORTCUTS.filter((d) => d.contexts.length < 6 && d.contexts.includes(ctx));
    if (defs.length === 0) return [];
    return [
      {
        id: `shortcuts_${ctx}`,
        title: CONTEXT_NAMES[ctx],
        lines: defs.map((d) => `${shortcutLabel(d.id)} — ${d.labelVi}`),
        frame: null,
      },
    ];
  });

const allContextShortcut = (): HelpEntry[] =>
  SHORTCUTS.filter((d) => d.contexts.length === 6).map((d) => ({
    id: `shortcuts_${d.id}`,
    title: 'Mọi màn hình',
    lines: [`${shortcutLabel(d.id)} — ${d.labelVi}`],
    frame: null,
  }));

export const buildHelpCatalog = (content: Content, level: Level = 1): HelpCatalog => {
  const kings = content.enemyKings();
  return {
    owners: [{ id: 'neutral', nameVi: 'Trung lập' }, ...kings.map((k) => ({ id: k.id, nameVi: k.nameVi }))],
    tabs: {
      cards: helpCards(content, { ...DEFAULT_HELP_FILTER, level }),
      mechanics: mechanicEntries(content),
      shortcuts: [...allContextShortcut(), ...shortcutEntries()],
      units: byId(content.allUnits()).map((u) => ({
        id: u.id,
        title: u.nameVi,
        lines: unitLines(u),
        frame: null,
      })),
      decrees: DECREES.map((d) => ({
        id: d.id,
        title: d.nameVi,
        lines: [decreeText(d, DECREE_RULES)],
        frame: null,
      })),
      quests: QUESTS.map((q) => ({
        id: q.id,
        title: q.nameVi,
        lines: [
          questText(q, QUEST_RULES),
          `Hạn: ${q.duration} năm`,
          `Thưởng: ${questRewardText(q, QUEST_RULES)}`,
        ],
        frame: null,
      })),
      banners: kings.map((k) => ({
        id: k.banner.id,
        title: `${k.banner.nameVi} (${k.nameVi})`,
        lines: [k.banner.textVi],
        frame: null,
      })),
      bosses: BOSSES.map((b) => ({
        id: b.id,
        title: `${b.unit.nameVi} (năm ${RUN.bossYears[b.ordinal - 1]})`,
        lines: [...unitLines(b.unit), ...bossSkillLines(b.id)],
        frame: null,
      })),
    },
  };
};

export { HELP_TABS };
