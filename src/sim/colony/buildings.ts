import { Not, query } from 'bitecs';
import { BUILDINGS, BUILDING_IDS, type BuildingRole } from '../../data/buildings';
import { UNREACHABLE_COOLDOWN } from '../../data/colonists';
import { Blueprint, Building, Position } from '../components';
import type { GameWorld } from '../GameWorld';
import type { Vec2 } from '../geom';

export const isUnreachable = (world: GameWorld, target: number): boolean =>
  (world.unreachable.get(target) ?? -1) > world.tick;

export const markUnreachable = (world: GameWorld, target: number): void => {
  world.unreachable.set(target, world.tick + UNREACHABLE_COOLDOWN);
};

/** Finished buildings with this role. */
export const buildingsWithRole = (world: GameWorld, role: BuildingRole): number[] =>
  Array.from(query(world.ecs, [Building, Not(Blueprint)])).filter(
    (eid) => BUILDINGS[BUILDING_IDS[Building.kind[eid]!]!].role === role,
  );

export const nearest = (eids: readonly number[], from: Vec2): number | null => {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const eid of eids) {
    const d = (Position.x[eid]! - from.x) ** 2 + (Position.y[eid]! - from.y) ** 2;
    if (d < bestDist) {
      best = eid;
      bestDist = d;
    }
  }
  return best;
};

/** Closest place to drop goods off / take them out (Hearthfire, finished storehouses). */
export const nearestDropPoint = (
  world: GameWorld,
  from: Vec2,
  { skipUnreachable = true }: { skipUnreachable?: boolean } = {},
): number | null =>
  nearest(
    buildingsWithRole(world, 'drop').filter(
      (eid) => !skipUnreachable || !isUnreachable(world, eid),
    ),
    from,
  );

/** Beds left in a tent, not counting `except` (who may already be heading there). */
export const freeBeds = (world: GameWorld, tent: number, except?: number): number => {
  const capacity = BUILDINGS[BUILDING_IDS[Building.kind[tent]!]!].sleepCapacity;
  let taken = 0;
  for (const [colonist, job] of world.jobs) {
    if (colonist !== except && job.kind === 'sleep' && job.target === tent) taken++;
  }
  return capacity - taken;
};
