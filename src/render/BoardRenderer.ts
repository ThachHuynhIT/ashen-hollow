import type Phaser from 'phaser';
import { BATTLE } from '../data/battle';
import { UI_PALETTE } from '../data/uiPalette';
import type { CardId } from '../data/types';
import type { Edge } from '../game/battle/types';
import { plotCenter } from '../game/battle/world';
import type { Content } from '../game/cards/registry';
import { THRONE_PLOT } from '../game/run/board';
import type { RunState } from '../game/run/state';
import { SPRITES_KEY, buildingFrame, plotFrame } from './atlas';

const SIZE = 5;
const PLOTS = SIZE * SIZE;
/** Ground layer: plots sit on the field (depth 0), under every y-sorted sprite. */
const PLOT_DEPTH = 1;
const HIGHLIGHT_DEPTH = 2;
/** Edge arrows are an overlay above every world sprite. */
const ARROW_DEPTH = 100_000;
const ARROW_INSET = 10;
const ARROW_HALF = 8;

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
  }

  /** Hide buildings while the battle renders them as structures (UnitRenderer). */
  setBuildingsVisible(visible: boolean): void {
    this.buildingsVisible = visible;
    this.buildings.forEach((b, p) => b?.setVisible(visible && this.cards[p] !== null));
  }

  /** Outline the given plots in UI_PALETTE.good / bad; an empty map clears them. */
  setHighlights(map: ReadonlyMap<number, 'good' | 'bad'>): void {
    const g = this.highlights;
    g.clear();
    const plots = [...map.keys()].sort((a, b) => a - b);
    for (const p of plots) {
      if (p < 0 || p >= PLOTS) continue;
      const c = plotCenter(p);
      const half = BATTLE.plot / 2;
      g.lineStyle(2, map.get(p) === 'good' ? UI_PALETTE.good : UI_PALETTE.bad, 1);
      g.strokeRect(c.x - half + 1, c.y - half + 1, BATTLE.plot - 2, BATTLE.plot - 2);
    }
  }

  /** Gold arrows at the middle of each edge the next army comes from, pointing inward. */
  setEdgeArrows(edges: readonly Edge[]): void {
    const g = this.arrows;
    g.clear();
    const f = BATTLE.field;
    const mid = f / 2;
    const i = ARROW_INSET;
    const h = ARROW_HALF;
    for (const edge of new Set(edges)) {
      // Triangle tip points into the field; drawn twice for a 1 px outline.
      const tri = ((): [number, number, number, number, number, number] => {
        switch (edge) {
          case 'N':
            return [mid - h, i, mid + h, i, mid, i + h];
          case 'S':
            return [mid - h, f - i, mid + h, f - i, mid, f - i - h];
          case 'W':
            return [i, mid - h, i, mid + h, i + h, mid];
          case 'E':
            return [f - i, mid - h, f - i, mid + h, f - i - h, mid];
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
  }

  private throneCard(state: RunState): CardId | null {
    try {
      return this.content.king(state.kingId).throne.id;
    } catch {
      return null;
    }
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
