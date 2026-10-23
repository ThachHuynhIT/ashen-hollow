import type Phaser from 'phaser';
import { TICKS_PER_SECOND } from '../../core/SimClock';
import { WAVES } from '../../data/battle';
import { bossEdge } from '../../game/run/battleSetup';
import type { UnitId } from '../../data/types';
import { UI_PALETTE } from '../../data/uiPalette';
import type { ArmyPlan, ArmyWave, Edge } from '../../game/battle/types';
import type { Content } from '../../game/cards/registry';
import { SPRITES_KEY, unitFrame } from '../../render/atlas';
import type { Rect } from '../hud/layout';
import { bossName } from './CalendarStrip';
import { addUiText, bindPress, createPanel, frameBorder, type UiBox } from '../theme';

/** Display name of each attacker (§10.4 Trinh sát: "tên … của kẻ tấn công"). */
export const attackerName = (plan: ArmyPlan, content: Content): string => {
  switch (plan.attacker) {
    case 'raiders':
      return 'Thổ Phỉ';
    case 'boss':
      return `Boss ${bossName(plan.boss)}`;
    case 'coalition':
      return `Liên Quân ${(plan.kings ?? []).map((k) => content.enemyKing(k).nameVi).join(' + ')}`;
    default:
      return content.enemyKing(plan.attacker).nameVi;
  }
};

/** The banner line of the attacking king; raiders, coalitions and bosses carry none (never a made-up one). */
export const attackerBanner = (plan: ArmyPlan, content: Content): string | null => {
  if (plan.attacker === 'raiders' || plan.attacker === 'boss' || plan.attacker === 'coalition') return null;
  const banner = content.enemyKing(plan.attacker).banner;
  return `Cờ hiệu ${banner.nameVi}: ${banner.textVi}`;
};

/** "Boss …: xuất hiện 0:12 · ← Đông" on a boss year (it joins at the second wave's tick and edge); null otherwise. */
export const bossLine = (plan: ArmyPlan): string | null => {
  if (plan.attacker !== 'boss') return null;
  const tick = WAVES.spawnTick[1];
  return `${bossName(plan.boss)}: xuất hiện ${tickClock(tick)} · ${EDGE_TEXT[bossEdge(plan)]}`;
};

/** Edge name and an arrow pointing into the field from that edge. */
const EDGE_TEXT: Record<Edge, string> = { N: '↓ Bắc', E: '← Đông', S: '↑ Nam', W: '→ Tây' };
const EDGE_ORDER: readonly Edge[] = ['N', 'E', 'S', 'W'];

const PAD = 4;
const ICON_GAP = 2;
const GROUP_GAP = 8;
const LINE_GAP = 4;

export type ScoutMode = 'full' | 'summary';

/** "m:ss" of a spawn tick. */
export const tickClock = (tick: number): string => {
  const s = Math.floor(tick / TICKS_PER_SECOND);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
};

/** Unit counts of a wave, sorted by unit id (stable, never Map-order dependent). */
export const waveGroups = (wave: ArmyWave): { unit: UnitId; count: number }[] => {
  const counts: Record<string, number> = {};
  for (const s of wave.units) counts[s.unit] = (counts[s.unit] ?? 0) + 1;
  return Object.keys(counts)
    .sort()
    .map((unit) => ({ unit: unit as UnitId, count: counts[unit]! }));
};

export const waveEdges = (wave: ArmyWave): Edge[] =>
  EDGE_ORDER.filter((e) => wave.units.some((u) => u.edge === e));

/**
 * The scouting report (§10.4): attacker name and level, then each wave's spawn time, entry
 * edges and unit icons × count. `full` is the desktop right column (and the mobile modal);
 * `summary` is the compact mobile panel that opens the full report when pressed.
 */
export class ScoutPanel {
  readonly container: Phaser.GameObjects.Container;
  private readonly box: UiBox;
  private readonly parts: Phaser.GameObjects.GameObject[] = [];
  private plan: ArmyPlan | null = null;
  private rect: Rect = { x: 0, y: 0, w: 32, h: 32 };
  private mode: ScoutMode = 'full';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly content: Content,
    onOpen?: () => void,
  ) {
    this.box = createPanel(scene, 'panel', 32, 32);
    this.container = scene.add.container(0, 0, [this.box.image]);
    if (onOpen) {
      bindPress(scene, this.box.image, { onClick: () => this.mode === 'summary' && onOpen() });
    }
  }

  setPlan(plan: ArmyPlan | null): void {
    this.plan = plan;
    this.render();
  }

  layout(rect: Rect, mode: ScoutMode): void {
    this.rect = rect;
    this.mode = mode;
    this.render();
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.container.destroy();
  }

  private render(): void {
    for (const p of this.parts) p.destroy();
    this.parts.length = 0;
    const { x, y, w, h } = this.rect;
    this.container.setPosition(x, y);
    this.box.resize(w, h);
    // Only the summary is a button.
    if (this.box.image.input) this.box.image.input.enabled = this.mode === 'summary';

    const inset = frameBorder(this.scene, 'panel') + PAD;
    const plan = this.plan;
    const full = this.mode === 'full';
    let cy = inset;
    const name = plan ? attackerName(plan, this.content) : '';

    if (full) {
      cy += this.text(inset, cy, 'Trinh sát', 16, true).height + LINE_GAP;
      if (plan) {
        cy += this.text(inset, cy, `${name} · Cấp ${plan.level}`, 13).height + LINE_GAP;
        const boss = bossLine(plan);
        if (boss !== null) {
          const line = this.text(inset, cy, boss, 12, true, UI_PALETTE.bad);
          line.setWordWrapWidth(w - 2 * inset);
          cy += line.height + LINE_GAP;
        }
        const bannerText = attackerBanner(plan, this.content);
        if (bannerText !== null) {
          const line = this.text(inset, cy, bannerText, 12, false, UI_PALETTE.woodDark);
          line.setWordWrapWidth(w - 2 * inset);
          cy += line.height + LINE_GAP;
        }
        cy += LINE_GAP;
      }
    } else {
      const head = plan ? `Trinh sát: ${name} · Cấp ${plan.level}` : 'Trinh sát';
      const t = this.text(inset, cy, head, 13, true);
      this.text(w - inset, cy, 'Xem ›', 12).setOrigin(1, 0);
      cy += t.height + LINE_GAP;
    }
    if (!plan) return;

    plan.waves.forEach((wave, i) => {
      const edges = waveEdges(wave)
        .map((e) => EDGE_TEXT[e])
        .join('  ');
      if (full) {
        const head = this.text(inset, cy, `Đợt ${i + 1} · ${tickClock(wave.spawnTick)}`, 13, true);
        this.text(w - inset, cy, edges, 12, false, UI_PALETTE.woodDark).setOrigin(1, 0);
        cy += head.height + LINE_GAP;
        cy += this.icons(wave, inset, cy, w - 2 * inset, true) + LINE_GAP * 2;
      } else {
        // One row per wave: "Đợt 1 ↓ Bắc" then the icons.
        const head = this.text(inset, cy, `Đợt ${i + 1}`, 12, true);
        const arrows = this.text(inset + 44, cy, edges, 11, false, UI_PALETTE.woodDark);
        const left = inset + 44 + arrows.width + GROUP_GAP;
        const rowH = this.icons(wave, left, cy, w - inset - left, false);
        cy += Math.max(head.height, rowH) + LINE_GAP;
      }
    });
  }

  /** Unit icons × count, wrapping inside `width`; returns the height used. */
  private icons(wave: ArmyWave, x0: number, y0: number, width: number, full: boolean): number {
    const maxIcon = full ? 32 : 20;
    let x = x0;
    let y = y0;
    let rowH = 0;
    let total = 0;
    for (const { unit, count } of waveGroups(wave)) {
      const frame = unitFrame(unit, 'foe', 'idle', 0);
      const tex = this.scene.textures;
      const img =
        tex.exists(SPRITES_KEY) && tex.get(SPRITES_KEY).has(frame)
          ? this.scene.add.image(0, 0, SPRITES_KEY, frame).setOrigin(0, 0)
          : null;
      if (img) {
        const fh = img.height;
        const scale = fh <= maxIcon ? Math.floor(maxIcon / fh) : 1 / Math.ceil(fh / maxIcon);
        img.setScale(scale);
      }
      const text = full ? `×${count} ${this.content.unit(unit).nameVi}` : `×${count}`;
      const label = addUiText(this.scene, 0, 0, text, 12).setOrigin(0, 0.5);
      const iw = img?.displayWidth ?? 0;
      const ih = Math.max(img?.displayHeight ?? 0, label.height);
      const gw = iw + ICON_GAP + label.width;
      if (x > x0 && x + gw > x0 + width) {
        y += rowH + LINE_GAP;
        total += rowH + LINE_GAP;
        x = x0;
        rowH = 0;
      }
      if (img) {
        img.setPosition(Math.round(x), Math.round(y + (ih - img.displayHeight) / 2));
        this.add(img);
      }
      label.setPosition(Math.round(x + iw + ICON_GAP), Math.round(y + ih / 2));
      this.add(label);
      x += gw + GROUP_GAP;
      rowH = Math.max(rowH, ih);
    }
    return total + rowH;
  }

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    bold = false,
    color: number = UI_PALETTE.text,
  ): Phaser.GameObjects.Text {
    const t = addUiText(this.scene, Math.round(x), Math.round(y), value, size, color);
    if (bold) t.setFontStyle('bold');
    this.add(t);
    return t;
  }

  private add(part: Phaser.GameObjects.GameObject): void {
    this.parts.push(part);
    this.container.add(part);
  }
}
