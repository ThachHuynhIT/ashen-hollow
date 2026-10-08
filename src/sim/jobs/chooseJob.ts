import { query } from 'bitecs';
import { NEEDS } from '../../data/colonists';
import { DOODAD_IDS } from '../../data/doodads';
import { CARRY_CAPACITY, type ResourceId } from '../../data/resources';
import { isFullySupplied, missingMaterials } from '../colony/blueprint';
import {
  buildingsWithRole,
  freeBeds,
  isUnreachable,
  nearest,
  nearestDropPoint,
} from '../colony/buildings';
import { isCarrying } from '../colony/colonists';
import { Blueprint, Designation, Doodad, Needs, Position } from '../components';
import type { GameWorld } from '../GameWorld';
import type { Vec2 } from '../geom';
import { newJob, type Job } from './types';

const here = (eid: number): Vec2 => ({ x: Position.x[eid]!, y: Position.y[eid]! });

const distanceTo = (from: Vec2, target: number): number =>
  Math.hypot(Position.x[target]! - from.x, Position.y[target]! - from.y);

/** Eat stored food at a drop point, or else the nearest free wild glowcap. */
export const findEat = (world: GameWorld, eid: number): Job | null => {
  const me = here(eid);
  if (world.stock.get('food') >= 1) {
    const drop = nearestDropPoint(world, me);
    if (drop !== null) return newJob('eat', drop, { wild: false });
  }
  const shrooms = Array.from(query(world.ecs, [Doodad])).filter(
    (d) =>
      DOODAD_IDS[Doodad.kind[d]!] === 'glowShroom' &&
      world.reservations.isFree(d, eid) &&
      !isUnreachable(world, d),
  );
  const shroom = nearest(shrooms, me);
  return shroom === null ? null : newJob('eat', shroom, { wild: true });
};

/** A tent with a free bed, or else the ground by the Hearthfire. */
export const findSleep = (world: GameWorld, eid: number): Job => {
  const tents = buildingsWithRole(world, 'sleep').filter(
    (t) => freeBeds(world, t, eid) > 0 && !isUnreachable(world, t),
  );
  return newJob('sleep', nearest(tents, here(eid)) ?? world.hearthfire);
};

/** Pick the best job for an idle colonist (spec §5.3, hunger before rest). */
export const chooseJob = (world: GameWorld, eid: number): Job => {
  const me = here(eid);

  // 6 — goods in hand go back first (or wait by the fire if nowhere is reachable).
  if (isCarrying(eid)) {
    const drop = nearestDropPoint(world, me);
    return drop !== null ? newJob('haulToDrop', drop) : newJob('idle', world.hearthfire);
  }

  // 5 — urgent needs; hunger first.
  const hunger = Needs.hunger[eid]!;
  const rest = Needs.rest[eid]!;
  if (hunger < NEEDS.urgent) {
    const eat = findEat(world, eid);
    if (eat) return eat;
  }
  if (rest < NEEDS.urgent) return findSleep(world, eid);

  const pick: { job: Job | null; score: number } = { job: null, score: -Infinity };
  const consider = (priority: number, target: number, job: Job) => {
    const score = priority * 1000 - distanceTo(me, target);
    if (score > pick.score) {
      pick.job = job;
      pick.score = score;
    }
  };

  // 4 / 3 — blueprints: build when supplied, otherwise bring what's missing.
  for (const bp of query(world.ecs, [Blueprint])) {
    if (isUnreachable(world, bp)) continue;
    if (isFullySupplied(bp)) {
      if (world.reservations.isFree(bp, eid)) consider(4, bp, newJob('construct', bp));
      continue;
    }
    for (const [resource, need] of Object.entries(missingMaterials(bp)) as [ResourceId, number][]) {
      const have = world.stock.get(resource);
      if (have <= 0) continue;
      const source = nearestDropPoint(world, me);
      if (source === null) break;
      const amount = Math.min(need, CARRY_CAPACITY, have);
      consider(3, bp, newJob('deliver', bp, { source, resource, amount }));
      break;
    }
  }

  // 2 — designated doodads.
  for (const d of query(world.ecs, [Designation])) {
    if (!isUnreachable(world, d) && world.reservations.isFree(d, eid)) {
      consider(2, d, newJob('harvest', d));
    }
  }

  // 1 — low (not urgent) needs.
  if (hunger < NEEDS.low) {
    const eat = findEat(world, eid);
    if (eat) consider(1, eat.target, eat);
  }
  if (rest < NEEDS.low) {
    const sleep = findSleep(world, eid);
    consider(1, sleep.target, sleep);
  }

  return pick.job ?? newJob('idle', world.hearthfire);
};
