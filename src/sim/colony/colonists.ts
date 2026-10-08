import { addComponent, addEntity, Not, query } from 'bitecs';
import { COLONIST_SPEED } from '../../data/colonists';
import { COLONIST_NAMES } from '../../data/names';
import { RESOURCE_IDS, resourceIndex, type ResourceId } from '../../data/resources';
import { Carry, Colonist, Dead, Mover, Needs, Position } from '../components';
import type { GameWorld } from '../GameWorld';

const SHIRTS = 4;

export const spawnColonist = (
  world: GameWorld,
  x: number,
  y: number,
  nameIndex: number,
): number => {
  const eid = addEntity(world.ecs);
  for (const c of [Position, Colonist, Needs, Mover, Carry]) addComponent(world.ecs, eid, c);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Colonist.nameIndex[eid] = nameIndex;
  Colonist.shirt[eid] = nameIndex % SHIRTS;
  Needs.hunger[eid] = 100;
  Needs.rest[eid] = 100;
  Needs.health[eid] = 100;
  Mover.speed[eid] = COLONIST_SPEED;
  Mover.stuckTicks[eid] = 0;
  Mover.repaths[eid] = 0;
  Carry.resource[eid] = -1;
  Carry.amount[eid] = 0;
  return eid;
};

/**
 * Spawn colonists in rings around the Hearthfire on walkable ground, with distinct
 * names picked by the world's RNG (deterministic per seed).
 */
export const spawnColonists = (world: GameWorld, count: number): number[] => {
  const names = COLONIST_NAMES.map((_, i) => i);
  for (let i = names.length - 1; i > 0; i--) {
    const j = world.rng.int(0, i);
    [names[i], names[j]] = [names[j]!, names[i]!];
  }
  const perRing = 12;
  const eids: number[] = [];
  for (let i = 0; i < count; i++) {
    const angle = ((i % perRing) / Math.min(count, perRing)) * Math.PI * 2;
    for (let radius = 24 + 8 * Math.floor(i / perRing); radius < 120; radius += 8) {
      const x = Math.round(world.start.x + Math.cos(angle) * radius);
      const y = Math.round(world.start.y + Math.sin(angle) * radius);
      const { cx, cy } = world.nav.cellOf(x, y);
      if (!world.nav.walkable(cx, cy)) continue;
      eids.push(spawnColonist(world, x, y, names[i % names.length]!));
      break;
    }
  }
  return eids;
};

export const livingColonists = (world: GameWorld): readonly number[] =>
  Array.from(query(world.ecs, [Colonist, Not(Dead)]));

export const colonistName = (eid: number): string => COLONIST_NAMES[Colonist.nameIndex[eid]!]!;

export const isCarrying = (eid: number): boolean =>
  Carry.resource[eid]! >= 0 && Carry.amount[eid]! > 0;

export const carryOf = (eid: number): { resource: ResourceId; amount: number } | null =>
  isCarrying(eid)
    ? { resource: RESOURCE_IDS[Carry.resource[eid]!]!, amount: Carry.amount[eid]! }
    : null;

export const setCarry = (eid: number, resource: ResourceId, amount: number): void => {
  Carry.resource[eid] = resourceIndex(resource);
  Carry.amount[eid] = amount;
};

export const clearCarry = (eid: number): void => {
  Carry.resource[eid] = -1;
  Carry.amount[eid] = 0;
};

/** The colonist whose body (16×24 sprite standing on its feet) covers the point. */
export const colonistAt = (world: GameWorld, x: number, y: number): number | null => {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const eid of query(world.ecs, [Colonist])) {
    const px = Position.x[eid]!;
    const py = Position.y[eid]!;
    if (Math.abs(x - px) > 6 || y < py - 22 || y > py + 3) continue;
    const d = (x - px) ** 2 + (y - py) ** 2;
    if (d < bestDist) {
      best = eid;
      bestDist = d;
    }
  }
  return best;
};
