import type Phaser from 'phaser';
import { BATTLE } from '../data/battle';
import { toCss } from '../data/palette';
import { UI_PALETTE } from '../data/uiPalette';
import type { CardId } from '../data/types';
import type { Edge } from '../game/battle/types';
import { plotCenter } from '../game/battle/world';
import type { Content } from '../game/cards/registry';
import { unlockCost } from '../data/run';
import { THRONE_PLOT, adjacentToUnlocked } from '../game/run/board';
import type { RunState } from '../game/run/state';
import { FONT_UI } from '../ui/theme';
import { SPRITES_KEY, buildingFrame, plotFrame } from './atlas';

const SIZE = 5;
const PLOTS = SIZE * SIZE;
/** Ground layer: plots sit on the field (depth 0), under every y-sorted sprite. */
const PLOT_DEPTH = 1;
const HIGHLIGHT_DEPTH = 2;
/** Edge arrows are an overlay above every world sprite. */
const ARROW_DEPTH = 100_000;
/** Level pips, enchantment dots and price labels sit just under the arrows. */
const MARK_DEPTH = 99_000;
/** Width of one pip / dot and the gap to the next (world px). */
const PIP = 3;
const PIP_STEP = 5;
/** Gap between the board and an edge arrow's tip (world px). */
const ARROW_GAP = 4;
const ARROW_HALF = 7;
/** How a plot is outlined while a card is aimed (§10.4): legal, illegal, or already picked. */
export type PlotHighlight = 'good' | 'bad' | 'selected' | 'levelUp';

const HIGHLIGHT_COLOR: Readonly<Record<PlotHighlight, number>> = {
  good: UI_PALETTE.good,
  levelUp: UI_PALETTE.good,
  bad: UI_PALETTE.bad,
  selected: UI_PALETTE.gold,
};

/** Foot y of a building standing on `plot` (the bottom edge of the cell, spec §11.2). */
export const buildingFootY = (plot: number): number => plotCenter(plot).y + BATTLE.plot / 2;

/**
 * The 5x5 board outside battle: plot ground, buildings anchored at their feet on the bottom
 * edge of their cell (depth = foot y), placement highlights and incoming-army edge arrows.
 */
export class BoardRenderer {
  private readonly scene: Phaser.Scene;
  private readonly content: Content;
  private readonly plots: Phaser.GameObjects.Image[] = [];
  private readonly buildings: (Phaser.GameObjects.Image | null)[] = [];
  /** Card shown on each plot's building image, null = none. */
  private readonly cards: (CardId | null)[] = [];
  private readonly highlights: Phaser.GameObjects.Graphics;
  private readonly arrows: Phaser.GameObjects.Graphics;
  /** Level pips (bottom) and enchantment dots (top) of each building. */
  private readonly marks: Phaser.GameObjects.Graphics;
  /** "4"-style gold price on every locked plot next to an open one. */
  private readonly prices: Phaser.GameObjects.Text[] = [];
  private buildingsVisible = true;

  constructor(scene: Phaser.Scene, content: Content) {
    this.scene = scene;
    this.content = content;
    for (let p = 0; p < PLOTS; p++) {
      const c = plotCenter(p);
      this.plots.push(
        scene.add.image(c.x, c.y, SPRITES_KEY, plotFrame('locked')).setDepth(PLOT_DEPTH),
      );
      this.buildings.push(null);
      this.cards.push(null);
    }
    this.highlights = scene.add.graphics().setDepth(HIGHLIGHT_DEPTH);
    this.arrows = scene.add.graphics().setDepth(ARROW_DEPTH);
    this.marks = scene.add.graphics().setDepth(MARK_DEPTH);
  }

  /** Redraw plots and buildings from the run state. */
  render(state: RunState): void {
    const throneId = this.throneCard(state);
    for (let p = 0; p < PLOTS; p++) {
      const plot = state.plots[p];
      const ground = p === THRONE_PLOT ? 'throne' : plot?.unlocked ? 'open' : 'locked';
      this.plots[p]!.setFrame(plotFrame(ground));
      const cardId = p === THRONE_PLOT ? throneId : (plot?.building?.cardId ?? null);
      this.setBuilding(p, cardId);
    }
    this.drawMarks(state);
    this.drawPrices(state);
  }

  /** Hide buildings while the battle renders them as structures (UnitRenderer). */
  setBuildingsVisible(visible: boolean): void {
    this.buildingsVisible = visible;
    this.buildings.forEach((b, p) => b?.setVisible(visible && this.cards[p] !== null));
    this.marks.setVisible(visible);
    for (const t of this.prices) t.setVisible(visible && t.getData('on') === true);
  }

  /** Outline plots in UI_PALETTE.good / bad, picked ones in gold; an empty map clears them. */
  setHighlights(map: ReadonlyMap<number, PlotHighlight>): void {
    const g = this.highlights;
    g.clear();
    const plots = [...map.keys()].sort((a, b) => a - b);
    for (const p of plots) {
      if (p < 0 || p >= PLOTS) continue;
      const c = plotCenter(p);
      const half = BATTLE.plot / 2;
      g.lineStyle(2, HIGHLIGHT_COLOR[map.get(p) ?? 'bad'], 1);
      g.strokeRect(c.x - half + 1, c.y - half + 1, BATTLE.plot - 2, BATTLE.plot - 2);
      if (map.get(p) === 'levelUp') {
        // A second, gold ring inside marks "this plays as a level-up".
        g.lineStyle(1, UI_PALETTE.gold, 1);
        g.strokeRect(c.x - half + 4, c.y - half + 4, BATTLE.plot - 8, BATTLE.plot - 8);
      }
    }
  }

  /**
   * Gold arrows pointing at the middle of each board side the next army comes from. They sit
   * just outside the board rather than at the field edge: the planning view crops the
   * field (§10.7 allows 48 px; the zoom-2 planning camera crops more, on mobile all sides),
   * while the board itself is always on screen.
   */
  setEdgeArrows(edges: readonly Edge[]): void {
    const g = this.arrows;
    g.clear();
    const lo = BATTLE.boardOrigin;
    const hi = BATTLE.boardOrigin + BATTLE.plot * SIZE;
    const mid = (lo + hi) / 2;
    const h = ARROW_HALF;
    const n = lo - ARROW_GAP; // tip of an arrow above / left of the board
    const s = hi + ARROW_GAP; // tip of an arrow below / right of the board
    for (const edge of new Set(edges)) {
      // Triangle tip points at the board; drawn twice for a 1 px outline.
      const tri = ((): [number, number, number, number, number, number] => {
        switch (edge) {
          case 'N':
            return [mid - h, n - h, mid + h, n - h, mid, n];
          case 'S':
            return [mid - h, s + h, mid + h, s + h, mid, s];
          case 'W':
            return [n - h, mid - h, n - h, mid + h, n, mid];
          case 'E':
            return [s + h, mid - h, s + h, mid + h, s, mid];
        }
      })();
      g.fillStyle(UI_PALETTE.gold, 1);
      g.fillTriangle(...tri);
      g.lineStyle(1, UI_PALETTE.outline, 1);
      g.strokeTriangle(...tri);
    }
  }

  /** Plot index (row × 5 + col) under a world point, null outside the board. */
  plotAt(worldX: number, worldY: number): number | null {
    const col = Math.floor((worldX - BATTLE.boardOrigin) / BATTLE.plot);
    const row = Math.floor((worldY - BATTLE.boardOrigin) / BATTLE.plot);
    if (col < 0 || col >= SIZE || row < 0 || row >= SIZE) return null;
    return row * SIZE + col;
  }

  destroy(): void {
    for (const p of this.plots) p.destroy();
    for (const b of this.buildings) b?.destroy();
    this.plots.length = 0;
    this.buildings.length = 0;
    this.cards.length = 0;
    this.highlights.destroy();
    this.arrows.destroy();
    this.marks.destroy();
    for (const t of this.prices) t.destroy();
    this.prices.length = 0;
  }

  /** Level pips along the bottom of a building's plot (level ≥ 2) and one dot per enchantment stack along the top. */
  private drawMarks(state: RunState): void {
    const g = this.marks;
    g.clear();
    for (let p = 0; p < PLOTS; p++) {
      const b = state.plots[p]?.building;
      if (!b) continue;
      const c = plotCenter(p);
      const left = c.x - BATTLE.plot / 2 + 3;
      const level = p === THRONE_PLOT ? state.throneLevel : b.level;
      const stacks = b.enchants.reduce((n, e) => n + e.stacks, 0);
      const pip = (i: number, y: number, color: number): void => {
        g.fillStyle(UI_PALETTE.outline, 1);
        g.fillRect(left + i * PIP_STEP - 1, y - 1, PIP + 2, PIP + 2);
        g.fillStyle(color, 1);
        g.fillRect(left + i * PIP_STEP, y, PIP, PIP);
      };
      if (level > 1) for (let i = 0; i < level; i++) pip(i, c.y + BATTLE.plot / 2 - 6, UI_PALETTE.gold);
      for (let i = 0; i < stacks; i++) pip(i, c.y - BATTLE.plot / 2 + 3, UI_PALETTE.select);
    }
  }

  /** Gold price on each locked plot that touches an open plot (spec §3.11). */
  private drawPrices(state: RunState): void {
    const price = unlockCost(state.purchasedPlots);
    let used = 0;
    for (let p = 0; p < PLOTS; p++) {
      const plot = state.plots[p];
      if (!plot || plot.unlocked || !adjacentToUnlocked(state.plots, p)) continue;
      let text = this.prices[used];
      if (!text) {
        text = this.scene.add
          .text(0, 0, '', { fontFamily: FONT_UI, fontSize: '11px', fontStyle: 'bold', color: toCss(UI_PALETTE.gold) })
          .setStroke(toCss(UI_PALETTE.outline), 3)
          .setOrigin(0.5)
          .setDepth(MARK_DEPTH + 1);
        this.prices.push(text);
      }
      const c = plotCenter(p);
      text.setText(`${price}`).setPosition(c.x, c.y).setData('on', true).setVisible(this.buildingsVisible);
      used++;
    }
    for (let i = used; i < this.prices.length; i++) this.prices[i]!.setData('on', false).setVisible(false);
  }

  private throneCard(state: RunState): CardId {
    let king;
    try {
      king = this.content.king(state.kingId);
    } catch (err) {
      throw new Error(`BoardRenderer: unknown king id "${state.kingId}"`, { cause: err });
    }
    return king.throne.id;
  }

  private setBuilding(plot: number, cardId: CardId | null): void {
    let img = this.buildings[plot] ?? null;
    const shown = this.cards[plot] ?? null;
    this.cards[plot] = cardId;
    if (cardId === null) {
      img?.setVisible(false);
      return;
    }
    if (img === null) {
      const c = plotCenter(plot);
      const foot = buildingFootY(plot);
      img = this.scene.add
        .image(c.x, foot, SPRITES_KEY, buildingFrame(cardId))
        .setOrigin(0.5, 1)
        .setDepth(foot);
      this.buildings[plot] = img;
    } else if (shown !== cardId) {
      img.setFrame(buildingFrame(cardId));
    }
    img.setVisible(this.buildingsVisible);
  }
}
