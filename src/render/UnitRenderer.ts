import type Phaser from 'phaser';
import { BATTLE } from '../data/battle';
import { UI_PALETTE } from '../data/uiPalette';
import type { CardId } from '../data/types';
import { KIND_UNIT, TEAM_ALLY, type BattleWorld } from '../game/battle/world';
import { SPRITES_KEY, buildingFrame, unitFrame } from './atlas';
import type { UnitAnim } from './unitArt';

/** Frames per second of each unit animation (spec §11.3: 6–8 idle/walk, 10–12 attack). */
const ANIM_FPS: Readonly<Record<UnitAnim, number>> = { idle: 6, walk: 8, attack: 11 };
/** A unit shows its attack frames for this many ticks after striking. */
const ATTACK_SHOW_TICKS = 2;
/** HP bars draw above every world sprite. */
const BAR_DEPTH = 99_000;
const BAR_H = 2;
const DEATH_MS = 180;

interface Slot {
  sprite: Phaser.GameObjects.Image;
  frame: string;
  facingLeft: boolean;
  dead: boolean;
}

/**
 * Every battle entity (units and structures, the throne included) as one sprite of the
 * `sprites` atlas, anchored at its feet and depth-sorted by foot y. Positions are
 * interpolated between ticks; sprites never rotate, only flip horizontally.
 */
export class UnitRenderer {
  private readonly scene: Phaser.Scene;
  private readonly slots: (Slot | null)[] = [];
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly frameOk = new Map<string, boolean>();
  private world: BattleWorld | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bars = scene.add.graphics().setDepth(BAR_DEPTH);
  }

  /** Draw `world` at `alpha` (0..1) of the way from the previous tick to the current one. */
  sync(world: BattleWorld, alpha: number): void {
    if (world !== this.world) {
      this.clearSlots();
      this.world = world;
    }
    const a = Math.min(1, Math.max(0, alpha));
    const now = this.scene.time.now;
    this.bars.clear();
    for (let id = 0; id < world.count; id++) {
      const known = this.slots[id];
      const slot = known === undefined ? this.create(world, id) : known;
      if (slot === null || slot.dead) continue;
      if (world.alive[id] === 0) {
        this.kill(slot);
        continue;
      }
      const x = world.prevX[id]! + (world.x[id]! - world.prevX[id]!) * a;
      const y = world.prevY[id]! + (world.y[id]! - world.prevY[id]!) * a;
      const isUnit = world.kind[id] === KIND_UNIT;
      const foot = isUnit ? y + world.radius[id]! : y + BATTLE.plot / 2;
      const sprite = slot.sprite;
      sprite.setPosition(Math.round(x), Math.round(foot)).setDepth(foot);
      if (isUnit) this.animate(world, id, slot, now);
      this.drawBar(world, id, sprite, isUnit);
    }
  }

  destroy(): void {
    this.clearSlots();
    this.bars.destroy();
    this.world = null;
  }

  private create(world: BattleWorld, id: number): Slot | null {
    const label = world.label[id] ?? '';
    const frame =
      world.kind[id] === KIND_UNIT
        ? unitFrame(label, world.team[id] === TEAM_ALLY ? 'ally' : 'foe', 'idle', 0)
        : buildingFrame(label as CardId);
    if (label === '' || !this.hasFrame(frame)) {
      this.slots[id] = null;
      return null;
    }
    const sprite = this.scene.add.image(world.x[id]!, world.y[id]!, SPRITES_KEY, frame);
    sprite.setOrigin(0.5, 1);
    const slot: Slot = { sprite, frame, facingLeft: world.team[id] !== TEAM_ALLY, dead: false };
    sprite.setFlipX(slot.facingLeft);
    this.slots[id] = slot;
    return slot;
  }

  private animate(world: BattleWorld, id: number, slot: Slot, now: number): void {
    const dx = world.x[id]! - world.prevX[id]!;
    const dy = world.y[id]! - world.prevY[id]!;
    const interval = world.interval[id]!;
    const attacking = interval > 0 && interval - world.cooldown[id]! < ATTACK_SHOW_TICKS;
    const anim: UnitAnim = attacking ? 'attack' : dx !== 0 || dy !== 0 ? 'walk' : 'idle';
    const n = Math.floor((now / 1000) * ANIM_FPS[anim]) % 2;
    const team = world.team[id] === TEAM_ALLY ? 'ally' : 'foe';
    const frame = unitFrame(world.label[id]!, team, anim, n);
    if (frame !== slot.frame && this.hasFrame(frame)) {
      slot.sprite.setFrame(frame);
      slot.frame = frame;
    }
    // Face the way we move; standing still, face the target.
    let face = dx;
    const t = world.target[id]!;
    if (face === 0 && t >= 0 && world.alive[t] === 1) face = world.x[t]! - world.x[id]!;
    if (face !== 0 && face < 0 !== slot.facingLeft) {
      slot.facingLeft = face < 0;
      slot.sprite.setFlipX(slot.facingLeft);
    }
  }

  private drawBar(
    world: BattleWorld,
    id: number,
    sprite: Phaser.GameObjects.Image,
    isUnit: boolean,
  ): void {
    const hp = world.hp[id]!;
    const max = world.maxHp[id]!;
    if (max <= 0 || (isUnit && hp >= max)) return;
    const w = isUnit ? Math.max(8, sprite.width - 4) : 24;
    const x = Math.round(sprite.x - w / 2);
    const y = Math.round(sprite.y - sprite.height - BAR_H - 2);
    const fill = Math.max(0, Math.min(1, hp / max));
    const g = this.bars;
    g.fillStyle(UI_PALETTE.outline, 1);
    g.fillRect(x - 1, y - 1, w + 2, BAR_H + 2);
    g.fillStyle(world.team[id] === TEAM_ALLY ? UI_PALETTE.good : UI_PALETTE.bad, 1);
    g.fillRect(x, y, Math.max(1, Math.round(w * fill)), BAR_H);
  }

  /** Short pop: fade out and rise a few px, then hide. */
  private kill(slot: Slot): void {
    slot.dead = true;
    const s = slot.sprite;
    this.scene.tweens.add({
      targets: s,
      alpha: 0,
      y: s.y - 4,
      duration: DEATH_MS,
      onComplete: () => s.setVisible(false),
    });
  }

  private hasFrame(frame: string): boolean {
    let ok = this.frameOk.get(frame);
    if (ok === undefined) {
      ok = this.scene.textures.get(SPRITES_KEY).has(frame);
      this.frameOk.set(frame, ok);
    }
    return ok;
  }

  private clearSlots(): void {
    for (const slot of this.slots) {
      if (slot === null || slot === undefined) continue;
      this.scene.tweens.killTweensOf(slot.sprite);
      slot.sprite.destroy();
    }
    this.slots.length = 0;
  }
}
