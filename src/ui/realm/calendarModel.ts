import { unlockCost } from '../../data/run';
import type { Rules } from '../../data/rules';
import type { BossId, KingId } from '../../data/types';
import { calendarFor, type CalendarSlot } from '../../game/run/calendar';
import type { IllegalReason, RunState } from '../../game/run/state';

/** One year of the calendar strip / modal. */
export interface CalendarCell {
  year: number;
  /** Who attacks that year: raiders, the enemy king of that slot, a two-king coalition or a boss. */
  attacker: 'raiders' | 'coalition' | 'boss' | KingId;
  /** Which attack of that king (1..3), null for raiders, coalitions and bosses. */
  attack: 1 | 2 | 3 | null;
  /** The two kings of a coalition. */
  kings?: readonly KingId[];
  boss?: BossId;
  /** The year being played now. */
  current: boolean;
}

const cell = (
  slot: CalendarSlot,
  year: number,
  enemyKings: readonly KingId[],
  current: boolean,
): CalendarCell => {
  if (slot.kind === 'coalition') {
    const kings = slot.kings.flatMap((n) => (enemyKings[n - 1] ? [enemyKings[n - 1]!] : []));
    return { year, attacker: 'coalition', attack: null, kings, current };
  }
  if (slot.kind === 'boss') return { year, attacker: 'boss', attack: null, boss: slot.boss, current };
  const king = slot.kind === 'king' ? enemyKings[slot.king - 1] : undefined;
  if (slot.kind === 'raiders' || king === undefined)
    return { year, attacker: 'raiders', attack: null, current };
  return { year, attacker: king, attack: slot.attack, current };
};

/** This year and up to `count - 1` following ones, never past `rules.years`. */
export const calendarCells = (
  state: Pick<RunState, 'year' | 'rules' | 'enemyKings' | 'enemies'>,
  count: number,
): CalendarCell[] => {
  const slots = calendarFor(state.rules);
  const out: CalendarCell[] = [];
  for (let year = state.year; year < state.year + count && year <= slots.length; year++)
    out.push(cell(slots[year - 1]!, year, state.enemyKings, year === state.year));
  return out;
};

/** Every year of the run (the calendar modal); none is `current`. */
export const fullCalendar = (rules: Rules, enemyKings: readonly KingId[]): CalendarCell[] =>
  calendarFor(rules).map((slot, i) => cell(slot, i + 1, enemyKings, false));

/** Gold price of the next locked plot (spec §3.11). */
export const lockedPlotPrice = (state: Pick<RunState, 'purchasedPlots'>): number =>
  unlockCost(state.purchasedPlots);

/** Why a play / purchase is refused (§4.4), in Vietnamese. */
export const illegalText = (reason: IllegalReason): string => ILLEGAL_TEXT[reason];

const ILLEGAL_TEXT: Record<IllegalReason, string> = {
  locked: 'Ô chưa mở.',
  throne: 'Không thể đặt lên Ngai.',
  occupied: 'Ô đã có công trình.',
  noBuilding: 'Ô này chưa có công trình.',
  noTarget: 'Không còn mục tiêu hợp lệ.',
  notAdjacent: 'Ô phải kề một ô đã mở.',
  notEnoughGold: 'Không đủ vàng.',
  maxLevel: 'Đã đạt cấp tối đa.',
  wrongKind: 'Bùa này không gắn được lên loại công trình đó.',
  stacksFull: 'Công trình đã đủ stack Bùa.',
  wrongPhase: 'Lúc này chưa dùng được.',
  alreadyPlayed: 'Năm nay bạn đã chơi hoặc bỏ thẻ.',
  notPlayed: 'Hãy chơi hoặc bỏ một thẻ trước.',
  badTarget: 'Mục tiêu không hợp lệ.',
  lastLife: 'Không thể: bạn chỉ còn 1 mạng.',
};
