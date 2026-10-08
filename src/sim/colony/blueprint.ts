import { addComponent, hasComponent, removeComponent } from 'bitecs';
import { BUILDINGS, BUILDING_IDS, type BuildingId } from '../../data/buildings';
import { COLONIST_RADIUS, WALL_STAKE_SPACING } from '../../data/colonists';
import { RESOURCE_IDS, resourceIndex, type ResourceId } from '../../data/resources';
import { Blueprint, Building, Position } from '../components';
import { emit } from '../events';
import {
  checkPlacement,
  spawnBuilding,
  type GameWorld,
  type PlaceResult,
  type PlacementOptions,
} from '../GameWorld';
import { inflateShape, shapeContains, type Shape, type Vec2 } from '../geom';
import { approachPoint } from '../movement/approach';
import { stopMoving } from '../movement/movement';
import { livingColonists } from './colonists';

const costOf = (eid: number) => BUILDINGS[BUILDING_IDS[Building.kind[eid]!]!].cost;

export const isBlueprint = (world: GameWorld, eid: number): boolean =>
  hasComponent(world.ecs, eid, Blueprint);

/** Place a building as a blueprint: reserves the spot, costs nothing until delivered. */
export const placeBlueprint = (
  world: GameWorld,
  kind: BuildingId,
  x: number,
  y: number,
  options: PlacementOptions = {},
): PlaceResult => {
  const check = checkPlacement(world, kind, x, y, options);
  if (!check.ok) return { ...check, eid: null };
  const eid = spawnBuilding(world, kind, check.shape, { solid: false });
  addComponent(world.ecs, eid, Blueprint);
  Blueprint.progress[eid] = 0;
  for (let r = 0; r < RESOURCE_IDS.length; r++) {
    Blueprint.delivered[r]![eid] = 0;
    Blueprint.pending[r]![eid] = 0;
  }
  emit(world, { type: 'blueprintPlaced', eid });
  return { ...check, eid };
};

/** Materials still to be brought: cost − delivered − in transit (positive entries only). */
export const missingMaterials = (eid: number): Partial<Record<ResourceId, number>> => {
  const out: Partial<Record<ResourceId, number>> = {};
  for (const [res, amount] of Object.entries(costOf(eid)) as [ResourceId, number][]) {
    const r = resourceIndex(res);
    const left = amount - Blueprint.delivered[r]![eid]! - Blueprint.pending[r]![eid]!;
    if (left > 0) out[res] = left;
  }
  return out;
};

/** Every material actually delivered (not just in transit). */
export const isFullySupplied = (eid: number): boolean =>
  (Object.entries(costOf(eid)) as [ResourceId, number][]).every(
    ([res, amount]) => Blueprint.delivered[resourceIndex(res)]![eid]! >= amount,
  );

/** A colonist promised to bring `amount` of `resource`. */
export const reservePending = (eid: number, resource: ResourceId, amount: number): void => {
  Blueprint.pending[resourceIndex(resource)]![eid]! += amount;
};

/** That promise was broken (job failed): give the amount back to "missing". */
export const releasePending = (eid: number, resource: ResourceId, amount: number): void => {
  const r = resourceIndex(resource);
  Blueprint.pending[r]![eid] = Math.max(0, Blueprint.pending[r]![eid]! - amount);
};

/** The goods arrived: pending → delivered. */
export const deliverToBlueprint = (
  _world: GameWorld,
  eid: number,
  resource: ResourceId,
  amount: number,
): void => {
  releasePending(eid, resource, amount);
  Blueprint.delivered[resourceIndex(resource)]![eid]! += amount;
};

/** The blueprint becomes a real, solid building. */
/** Anyone standing where the building just appeared steps to the nearest free spot. */
const pushColonistsOut = (world: GameWorld, shape: Shape): void => {
  const keepOut = inflateShape(shape, COLONIST_RADIUS);
  for (const eid of livingColonists(world)) {
    const x = Position.x[eid]!;
    const y = Position.y[eid]!;
    if (!shapeContains(keepOut, x, y)) continue;
    const spot = approachPoint(world, shape, { x, y });
    if (!spot) continue;
    Position.x[eid] = spot.x;
    Position.y[eid] = spot.y;
    stopMoving(world, eid);
    const job = world.jobs.get(eid);
    if (job) job.dest = undefined;
  }
};

export const completeBlueprint = (world: GameWorld, eid: number): void => {
  removeComponent(world.ecs, eid, Blueprint);
  const record = world.obstacles.get(eid);
  if (record && !record.blocksMovement) {
    record.blocksMovement = true;
    world.nav.block(record.shape);
    pushColonistsOut(world, record.shape);
  }
  emit(world, { type: 'buildingCompleted', eid });
};

export interface WallStakePlan {
  x: number;
  y: number;
  ok: boolean;
}

/** Stakes every 8 px along A→B (inclusive), each checked for placement on its own. */
export const planWall = (world: GameWorld, a: Vec2, b: Vec2): WallStakePlan[] => {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const count = Math.floor(length / WALL_STAKE_SPACING) + 1;
  const plan: WallStakePlan[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i * WALL_STAKE_SPACING) / length;
    const x = Math.round(a.x + (b.x - a.x) * t);
    const y = Math.round(a.y + (b.y - a.y) * t);
    plan.push({ x, y, ok: checkPlacement(world, 'wallStake', x, y).ok });
  }
  return plan;
};

/** Place every placeable stake of a planned wall as a blueprint. */
export const placeWall = (world: GameWorld, a: Vec2, b: Vec2): number[] => {
  const eids: number[] = [];
  for (const stake of planWall(world, a, b)) {
    if (!stake.ok) continue;
    const r = placeBlueprint(world, 'wallStake', stake.x, stake.y);
    if (r.eid !== null) eids.push(r.eid);
  }
  return eids;
};
