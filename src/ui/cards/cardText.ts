import type { CardDef, Level } from '../../data/types';
import { RUN } from '../../data/run';
import { describeCard } from '../../game/cards/describe';
import type { PlotState } from '../../game/run/state';
import { ellipsize } from '../hud/layout';

/** "Lên cấp N" for a card that will level a building up to N, else null. */
export const cardBadge = (_card: CardDef, willLevelUpTo: Level | null): string | null =>
  willLevelUpTo === null ? null : `Lên cấp ${willLevelUpTo}`;

const isBuilding = (card: CardDef): boolean =>
  card.kind === 'troop' || card.kind === 'tower' || card.kind === 'economy' || card.kind === 'support';

/** "Cấp sau: …" — what `card` does at `level + 1`; null at the top level or for cards without levels. */
export const nextLevelLine = (card: CardDef, level: Level): string | null => {
  if (!isBuilding(card) || level >= RUN.maxLevel) return null;
  return `Cấp sau: ${describeCard(card, (level + 1) as Level).lines[0] ?? ''}`;
};

/**
 * The level playing `card` again would reach: one above the lowest copy of the same card on
 * the board that is below the top level; null when there is none (or `card` is not a building).
 */
export const willLevelUpTo = (plots: readonly PlotState[], card: CardDef): Level | null => {
  if (!isBuilding(card)) return null;
  let lowest: number | null = null;
  for (const p of plots) {
    const b = p.building;
    if (b === null || b.cardId !== card.id || b.level >= RUN.maxLevel) continue;
    if (lowest === null || b.level < lowest) lowest = b.level;
  }
  return lowest === null ? null : ((lowest + 1) as Level);
};

/** Greedy word wrap into at most `max` lines; the last line is cut with "…" if needed. */
export const clampLines = (
  text: string,
  width: number,
  max: number,
  measure: (s: string) => number,
): string[] => {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let i = 0;
  while (i < words.length && lines.length < max - 1) {
    let line = words[i]!;
    i++;
    while (i < words.length && measure(`${line} ${words[i]}`) <= width) {
      line = `${line} ${words[i]}`;
      i++;
    }
    lines.push(ellipsize(line, width, measure));
  }
  if (i < words.length) lines.push(ellipsize(words.slice(i).join(' '), width, measure));
  return lines;
};
