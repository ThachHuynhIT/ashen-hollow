import type Phaser from 'phaser';
import { INTERVENTION } from '../data/battle';
import { PALETTE } from '../data/palette';
import type { BattleEvent } from '../game/battle/types';
import type { BattleWorld } from '../game/battle/world';
import { SPRITES_KEY, fxFrame } from './atlas';
import { arrowDir } from './fxArt';

/** Projectiles fly this many px above the ground point they track. */
const FLIGHT_H = 6;
/** The royal boulder starts this many px above its landing point. */
const BOULDER_DROP_H = 96;
/** Ground shadows sit above plots (depth 1–2) and under every y-sorted sprite. */
const SHADOW_DEPTH = 3;
const SPARK_MS = 160;
const RING_MS = 320;
const RING_DEPTH = 99_500;

interface Ring {
  x: number;
  y: number;
  start: number;
}

/**
 * Battle effects: projectiles from the world's pool (one pre-drawn arrow per direction,
 * never rotated), a spark on each `hit`, the falling royal boulder with its shadow and an
 * impact ring. The caller passes the events it drained from the world this frame.
 * The `boulder drop` event is intentionally unused: the falling boulder is drawn from
 * `world.boulders` (dropTick/impactTick), which also follows pause and game speed.
 */
export class FxRenderer {
  private readonly scene: Phaser.Scene;
  private readonly projectiles: Phaser.GameObjects.Image[] = [];
  private readonly boulders: Phaser.GameObjects.Image[] = [];
  private readonly shadows: Phaser.GameObjects.Image[] = [];
  private readonly sparks: Phaser.GameObjects.Image[] = [];
  private readonly rings: Ring[] = [];
  private readonly ringGfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.ringGfx = scene.add.graphics().setDepth(RING_DEPTH);
  }

  sync(world: BattleWorld, events: readonly BattleEvent[], alpha: number): void {
    const a = Math.min(1, Math.max(0, alpha));
    const now = this.scene.time.now;
    for (const e of events) {
      if (e.type === 'hit') this.spark(world, e.id);
      else if (e.type === 'boulder' && e.phase === 'impact')
        this.rings.push({ x: e.x, y: e.y, start: now });
    }
    this.syncProjectiles(world, a);
    this.syncBoulders(world, a);
    this.drawRings(now);
  }

  destroy(): void {
    for (const list of [this.projectiles, this.boulders, this.shadows, this.sparks]) {
      for (const img of list) {
        this.scene.tweens.killTweensOf(img);
        img.destroy();
      }
      list.length = 0;
    }
    this.rings.length = 0;
    this.ringGfx.destroy();
  }

  /**
   * Each live projectile, drawn a fraction of one step behind its current point so motion
   * between ticks stays smooth (the pool compacts, so there is no per-projectile history).
   */
  private syncProjectiles(world: BattleWorld, a: number): void {
    const p = world.projectiles;
    const n = world.projectileCount;
    let used = 0;
    for (let k = 0; k < n; k++) {
      if (p.alive[k] === 0) continue;
      const t = p.targetId[k]!;
      const dx = world.x[t]! - p.px[k]!;
      const dy = world.y[t]! - p.py[k]!;
      const d = Math.sqrt(dx * dx + dy * dy);
      // Step back at most one tick of motion and never behind the shooter.
      const src = p.sourceId[k]!;
      const sx = p.px[k]! - world.x[src]!;
      const sy = p.py[k]! - world.y[src]!;
      const travelled = Math.sqrt(sx * sx + sy * sy);
      const backDist = Math.min(p.speed[k]! * (1 - a), travelled);
      const back = d > 0 ? backDist / d : 0;
      const x = p.px[k]! - dx * back;
      const y = p.py[k]! - dy * back;
      const img = this.image(this.projectiles, used, fxFrame(`arrow_${arrowDir(dx, dy)}`));
      img.setPosition(Math.round(x), Math.round(y - FLIGHT_H)).setDepth(y);
      used += 1;
    }
    for (let i = used; i < this.projectiles.length; i++) this.projectiles[i]!.setVisible(false);
  }

  /** Boulders still falling: the shadow grows on the ground, the rock drops over delayTicks. */
  private syncBoulders(world: BattleWorld, a: number): void {
    const list = world.boulders;
    for (let i = 0; i < list.length; i++) {
      const b = list[i]!;
      const span = Math.max(1, b.impactTick - b.dropTick);
      const t = Math.min(1, Math.max(0, (world.tick + a - b.dropTick) / span));
      const shadow = this.image(this.shadows, i, fxFrame('boulder_shadow'));
      shadow
        .setPosition(b.x, b.y)
        .setDepth(SHADOW_DEPTH)
        .setScale(0.5 + t * 0.5);
      const rock = this.image(this.boulders, i, fxFrame('boulder'));
      // Accelerating fall: height × (1 − t²).
      rock.setPosition(b.x, Math.round(b.y + 4 - BOULDER_DROP_H * (1 - t * t))).setDepth(b.y + 4);
    }
    for (let i = list.length; i < this.boulders.length; i++) {
      this.boulders[i]!.setVisible(false);
      this.shadows[i]!.setVisible(false);
    }
  }

  private spark(world: BattleWorld, id: number): void {
    if (id < 0 || id >= world.count) return;
    let img: Phaser.GameObjects.Image | undefined;
    for (const s of this.sparks)
      if (!s.visible) {
        img = s;
        break;
      }
    if (img === undefined) {
      img = this.scene.add.image(0, 0, SPRITES_KEY, fxFrame('spark'));
      this.sparks.push(img);
    }
    const r = world.radius[id]!;
    const x = world.x[id]!;
    const y = world.y[id]!;
    const s = img;
    this.scene.tweens.killTweensOf(s);
    s.setPosition(Math.round(x), Math.round(y - r))
      .setDepth(y + r + 1)
      .setAlpha(1)
      .setVisible(true);
    this.scene.tweens.add({
      targets: s,
      alpha: 0,
      y: s.y - 3,
      duration: SPARK_MS,
      onComplete: () => s.setVisible(false),
    });
  }

  private drawRings(now: number): void {
    const g = this.ringGfx;
    g.clear();
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i]!;
      const t = (now - ring.start) / RING_MS;
      if (t >= 1) {
        this.rings.splice(i, 1);
        continue;
      }
      g.lineStyle(2, PALETTE.cream, 1 - t);
      g.strokeCircle(ring.x, ring.y, 4 + (INTERVENTION.radius - 4) * t);
    }
  }

  /** Pooled image `i` of `list`, created on first use, shown with `frame`. */
  private image(
    list: Phaser.GameObjects.Image[],
    i: number,
    frame: string,
  ): Phaser.GameObjects.Image {
    let img = list[i];
    if (img === undefined) {
      img = this.scene.add.image(0, 0, SPRITES_KEY, frame);
      list.push(img);
    } else if (img.frame.name !== frame) {
      img.setFrame(frame);
    }
    return img.setVisible(true);
  }
}
