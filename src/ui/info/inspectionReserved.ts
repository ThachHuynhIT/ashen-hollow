/** Các nút/khung điều khiển mà bảng thông tin không được che (thuần). */
import type { Rect } from '../hud/layout';
import type { BattleLayout, PlanningLayout } from '../realm/realmLayout';

const present = (...rects: (Rect | null)[]): Rect[] => rects.filter((r): r is Rect => r !== null);

export const planningControls = (l: PlanningLayout): Rect[] => [
  ...present(l.lives, l.gold, l.help, l.year, l.reroll, l.sell, l.deck, l.fight, l.scoutButton, l.decreeButton),
  ...l.calendar,
  ...l.hand,
];

export const battleControls = (l: BattleLayout): Rect[] => [
  l.clock, l.lives, l.gold, l.help, l.foes, ...l.speed, l.intervene, l.auto, l.waves,
];
