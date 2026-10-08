import { MOVEMENT } from '../../data/colonists';
import { livingColonists } from '../colony/colonists';
import { Mover, Position } from '../components';
import type { GameWorld } from '../GameWorld';
import type { Vec2 } from '../geom';

export type MoveResult = 'arrived' | 'moving' | 'failed';

const sameDest = (a: Vec2 | undefined, b: Vec2): boolean => !!a && a.x === b.x && a.y === b.y;

export const stopMoving = (world: GameWorld, eid: number): void => {
  world.paths.delete(eid);
  world.pathDest.delete(eid);
  Mover.stuckTicks[eid] = 0;
  Mover.repaths[eid] = 0;
};

export const isMoving = (world: GameWorld, eid: number): boolean =>
  (world.paths.get(eid)?.length ?? 0) > 0;

/**
 * Drive a colonist towards `dest`. Call every tick from a job stage: it (re)plans when
 * the destination changes, the path ran out, or the colonist is stuck, and gives up
 * after MOVEMENT.maxRepaths re-plans. The movement system does the actual walking.
 */
export const moveTo = (world: GameWorld, eid: number, dest: Vec2): MoveResult => {
  const here = { x: Position.x[eid]!, y: Position.y[eid]! };
  if (Math.hypot(dest.x - here.x, dest.y - here.y) <= MOVEMENT.arriveDistance) {
    stopMoving(world, eid);
    return 'arrived';
  }
  const path = world.paths.get(eid);
  const newDest = !sameDest(world.pathDest.get(eid), dest);
  const stuck = Mover.stuckTicks[eid]! >= MOVEMENT.stuckTicks;
  if (newDest || stuck || !path || path.length === 0) {
    if (newDest) {
      Mover.repaths[eid] = 0;
    } else if (Mover.repaths[eid]! >= MOVEMENT.maxRepaths) {
      stopMoving(world, eid);
      return 'failed';
    } else {
      Mover.repaths[eid]! += 1;
    }
    const found = world.pathService.find(here, dest);
    if (!found) {
      stopMoving(world, eid);
      return 'failed';
    }
    world.paths.set(eid, found.slice(1));
    world.pathDest.set(eid, dest);
    Mover.stuckTicks[eid] = 0;
  }
  return 'moving';
};

const terrainSpeedAt = (world: GameWorld, x: number, y: number): number => {
  const { cx, cy } = world.nav.cellOf(x, y);
  const s = world.nav.inBounds(cx, cy) ? world.nav.speed[cy * world.nav.width + cx]! : 0;
  return s > 0 ? s : 1;
};

const walkableAt = (world: GameWorld, x: number, y: number): boolean => {
  const { cx, cy } = world.nav.cellOf(x, y);
  return world.nav.walkable(cx, cy);
};

/** Follow paths at colonist speed × ground speed, then keep colonists from stacking. */
export const movementSystem = (world: GameWorld): void => {
  const living = livingColonists(world);
  for (const eid of living) {
    const path = world.paths.get(eid);
    if (!path || path.length === 0) continue;
    const x0 = Position.x[eid]!;
    const y0 = Position.y[eid]!;
    let budget = Mover.speed[eid]! * terrainSpeedAt(world, x0, y0);
    while (budget > 0 && path.length > 0) {
      const wp = path[0]!;
      const dx = wp.x - Position.x[eid]!;
      const dy = wp.y - Position.y[eid]!;
      const d = Math.hypot(dx, dy);
      if (d <= budget) {
        Position.x[eid] = wp.x;
        Position.y[eid] = wp.y;
        path.shift();
        budget -= d;
      } else {
        Position.x[eid] = Position.x[eid]! + (dx / d) * budget;
        Position.y[eid] = Position.y[eid]! + (dy / d) * budget;
        budget = 0;
      }
    }
    const moved = Math.hypot(Position.x[eid]! - x0, Position.y[eid]! - y0);
    Mover.stuckTicks[eid] = moved < MOVEMENT.stuckProgress ? Mover.stuckTicks[eid]! + 1 : 0;
  }

  // Separation: nudge overlapping colonists apart (never onto blocked ground).
  const r = MOVEMENT.separationRadius;
  for (let i = 0; i < living.length; i++) {
    for (let j = i + 1; j < living.length; j++) {
      const a = living[i]!;
      const b = living[j]!;
      let dx = Position.x[b]! - Position.x[a]!;
      let dy = Position.y[b]! - Position.y[a]!;
      let d = Math.hypot(dx, dy);
      if (d >= r) continue;
      if (d < 1e-3) {
        // Exactly on top of each other: split along a fixed, deterministic axis.
        dx = 1;
        dy = 0;
        d = 1;
      }
      const px = (dx / d) * MOVEMENT.separationPush;
      const py = (dy / d) * MOVEMENT.separationPush;
      if (walkableAt(world, Position.x[a]! - px, Position.y[a]! - py)) {
        Position.x[a] = Position.x[a]! - px;
        Position.y[a] = Position.y[a]! - py;
      }
      if (walkableAt(world, Position.x[b]! + px, Position.y[b]! + py)) {
        Position.x[b] = Position.x[b]! + px;
        Position.y[b] = Position.y[b]! + py;
      }
    }
  }
};
