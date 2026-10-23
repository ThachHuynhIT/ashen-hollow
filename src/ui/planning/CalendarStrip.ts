import type Phaser from 'phaser';
import { BOSSES } from '../../data/bosses';
import { PALETTE } from '../../data/palette';
import { UI_PALETTE } from '../../data/uiPalette';
import type { Content } from '../../game/cards/registry';
import { SPRITES_KEY, iconFrame } from '../../render/atlas';
import type { Rect } from '../hud/layout';
import type { CalendarCell } from '../realm/calendarModel';
import {
  addUiText,
  bindPress,
  createPanel,
  type PressHandle,
  type TooltipHost,
  type UiBox,
} from '../theme';

/** Display name of a boss id. */
export const bossName = (id: string | undefined): string =>
  BOSSES.find((b) => b.id === id)?.unit.nameVi ?? 'Boss';

/**
 * "Năm 3 — Vua Đá Núi tấn công (lần 1/3)", "Năm 5 — Thổ Phỉ", "Năm 10 — Boss Ông Kẹ Đầm Lầy"
 * or "Năm 23 — Liên Quân A + B", then a line for the council and the quest of that year.
 */
export const calendarCellText = (cell: CalendarCell, content: Content): string[] => {
  const head = `Năm ${cell.year}`;
  const lines: string[] = [];
  if (cell.attacker === 'raiders') lines.push('Thổ Phỉ tấn công.');
  else if (cell.attacker === 'boss') lines.push(`Boss ${bossName(cell.boss)} tấn công.`);
  else if (cell.attacker === 'coalition') {
    const names = (cell.kings ?? []).map((k) => content.enemyKing(k).nameVi).join(' + ');
    lines.push(`Liên Quân ${names} tấn công.`);
  } else {
    lines.push(`${content.enemyKing(cell.attacker).nameVi} tấn công (lần ${cell.attack}/3).`);
  }
  if (cell.council) lines.push('Sau trận: Hội Đồng Hoàng Gia.');
  if (cell.quest) lines.push('Đầu năm: có thể có nhiệm vụ.');
  return [head, ...lines];
};

const DOT = 4;

/**
 * One year of the calendar: the year number, the attacker's badge (a skull for raiders, a
 * square in the king's colour) and one dot per attack of that king so far. The current year
 * has the selected frame. Used by the strip and by the full calendar modal.
 */
export class CalendarCellView {
  readonly container: Phaser.GameObjects.Container;
  private readonly box: UiBox;
  private readonly parts: Phaser.GameObjects.GameObject[] = [];
  private cell: CalendarCell | null = null;
  private rect: Rect = { x: 0, y: 0, w: 52, h: 52 };
  private readonly press: PressHandle;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly content: Content,
    tooltip: TooltipHost,
    onClick: () => void,
  ) {
    this.box = createPanel(scene, 'slot', 52, 52);
    this.container = scene.add.container(0, 0, [this.box.image]);
    this.press = bindPress(scene, this.box.image, {
      onClick,
      tooltip: {
        host: tooltip,
        content: () => {
          if (!this.cell) return null;
          const [title, ...rest] = calendarCellText(this.cell, this.content);
          return { title, lines: rest.map((text) => [{ text }]) };
        },
      },
    });
  }

  set(cell: CalendarCell | null): void {
    this.cell = cell;
    this.press.cancel();
    this.render();
  }

  layout(rect: Rect): void {
    this.rect = rect;
    this.render();
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
    if (visible && this.cell) this.box.image.setInteractive();
    else this.box.image.disableInteractive();
  }

  destroy(): void {
    this.press.cancel();
    this.container.destroy();
  }

  private render(): void {
    for (const p of this.parts) p.destroy();
    this.parts.length = 0;
    const { x, y, w, h } = this.rect;
    this.container.setPosition(x, y);
    this.box.resize(w, h);
    const cell = this.cell;
    this.setVisible(cell !== null);
    if (!cell) return;
    this.box.setFrame(cell.current ? 'slotSelected' : 'slot');

    const year = addUiText(this.scene, 5, 3, `${cell.year}`, w >= 60 ? 14 : 12).setFontStyle('bold');
    this.add(year);

    const cx = w / 2;
    const cy = h / 2 + 3;
    const skull = (): void => {
      const tex = this.scene.textures;
      if (tex.exists(SPRITES_KEY) && tex.get(SPRITES_KEY).has(iconFrame('skull'))) {
        this.add(this.scene.add.image(cx, cy, SPRITES_KEY, iconFrame('skull')).setOrigin(0.5));
      }
    };
    this.markers(cell, w);
    if (cell.attacker === 'raiders' || cell.attacker === 'boss') {
      skull();
      return;
    }
    const side = Math.max(14, Math.round(w * 0.3));
    if (cell.attacker === 'coalition') {
      // Two kings fight together: two badges side by side, each in its king's colour.
      const kings = cell.kings ?? [];
      const small = Math.max(10, Math.round(w * 0.22));
      kings.forEach((id, i) => {
        const dx = cx + (i - (kings.length - 1) / 2) * (small + 3);
        const badge = this.scene.add
          .rectangle(dx, cy, small, small, PALETTE[this.content.enemyKing(id).color])
          .setStrokeStyle(2, UI_PALETTE.outline);
        this.add(badge);
      });
      return;
    }
    const king = this.content.enemyKing(cell.attacker);
    const badge = this.scene.add
      .rectangle(cx, cy, side, side, PALETTE[king.color])
      .setStrokeStyle(2, UI_PALETTE.outline);
    this.add(badge);
    const dots = cell.attack ?? 0;
    for (let i = 0; i < dots; i++) {
      const dx = cx + (i - (dots - 1) / 2) * (DOT + 3);
      this.add(this.scene.add.rectangle(dx, h - 7, DOT, DOT, UI_PALETTE.select).setStrokeStyle(1, UI_PALETTE.outline));
    }
  }

  /** Council (crown) and quest (tome) markers in the top-right corner. */
  private markers(cell: CalendarCell, w: number): void {
    const tex = this.scene.textures;
    if (!tex.exists(SPRITES_KEY)) return;
    const atlas = tex.get(SPRITES_KEY);
    let x = w - 3;
    for (const [on, icon] of [
      [cell.council, 'crown'],
      [cell.quest, 'tome'],
    ] as const) {
      if (!on || !atlas.has(iconFrame(icon))) continue;
      this.add(this.scene.add.image(x, 3, SPRITES_KEY, iconFrame(icon)).setOrigin(1, 0).setScale(0.75));
      x -= 13;
    }
  }

  private add(part: Phaser.GameObjects.GameObject): void {
    this.parts.push(part);
    this.container.add(part);
  }
}

/** The five-year calendar strip of the planning HUD (§10.4); pressing a cell opens the full calendar. */
export class CalendarStrip {
  private readonly cells: CalendarCellView[];

  constructor(scene: Phaser.Scene, content: Content, tooltip: TooltipHost, onOpen: () => void) {
    this.cells = Array.from({ length: 5 }, () => new CalendarCellView(scene, content, tooltip, onOpen));
  }

  /** Cells to show (fewer than 5 near the last year). */
  setCells(cells: readonly CalendarCell[]): void {
    this.cells.forEach((view, i) => view.set(cells[i] ?? null));
  }

  layout(rects: readonly Rect[]): void {
    this.cells.forEach((view, i) => {
      const r = rects[i];
      if (r) view.layout(r);
    });
  }

  setVisible(visible: boolean): void {
    this.cells.forEach((v) => v.setVisible(visible));
  }

  destroy(): void {
    for (const v of this.cells) v.destroy();
    this.cells.length = 0;
  }
}
