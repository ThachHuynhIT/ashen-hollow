import { hasComponent } from 'bitecs';
import { IDLE_PAUSE_TICKS, IDLE_WANDER_RADIUS } from '../../data/colonists';
import { BUILDINGS, BUILDING_IDS } from '../../data/buildings';
import { DOODADS, DOODAD_IDS } from '../../data/doodads';
import {
  completeBlueprint,
  deliverToBlueprint,
  isBlueprint,
  releasePending,
} from '../colony/blueprint';
import { markUnreachable } from '../colony/buildings';
import { carryOf, clearCarry, isCarrying, setCarry } from '../colony/colonists';
import { Blueprint, Building, Designation, Doodad, Position } from '../components';
import { emit } from '../events';
import { removeWorldEntity, type GameWorld } from '../GameWorld';
import type { Vec2 } from '../geom';
import { approachPoint } from '../movement/approach';
import { moveTo } from '../movement/movement';
import type { Job, JobKind, JobStatus } from './types';

export type Runner = (world: GameWorld, eid: number, job: Job) => JobStatus;

const here = (eid: number): Vec2 => ({ x: Position.x[eid]!, y: Position.y[eid]! });

export const nextStage = (job: Job): void => {
  job.stage++;
  job.timer = 0;
  job.dest = undefined;
};

/**
 * Walk next to `target` (an obstacle entity). Fails — and marks the target
 * unreachable for a while — if there is nowhere to stand or no path; advances the
 * job to its next stage on arrival.
 */
export const walkStage = (world: GameWorld, eid: number, job: Job, target: number): JobStatus => {
  const shape = world.obstacles.get(target)?.shape;
  if (!shape) return 'failed';
  if (!job.dest) {
    const spot = approachPoint(world, shape, here(eid));
    if (!spot) {
      markUnreachable(world, target);
      return 'failed';
    }
    job.dest = spot;
  }
  const result = moveTo(world, eid, job.dest);
  if (result === 'failed') {
    markUnreachable(world, target);
    return 'failed';
  }
  if (result === 'arrived') nextStage(job);
  return 'running';
};

/** Walk to a designated doodad, work it, pick up the yield. */
const runHarvest: Runner = (world, eid, job) => {
  const target = job.target;
  if (!world.obstacles.has(target) || !hasComponent(world.ecs, target, Designation))
    return 'failed';
  if (job.stage === 0) return walkStage(world, eid, job, target);
  const def = DOODADS[DOODAD_IDS[Doodad.kind[target]!]!];
  job.timer++;
  if (job.timer < (def.harvest?.workTicks ?? 0)) return 'running';
  if (def.yields) setCarry(eid, def.yields.resource, def.yields.amount);
  removeWorldEntity(world, target);
  return 'done';
};

/** Carry goods in hand to a drop point and add them to the stock. */
const runHaul: Runner = (world, eid, job) => {
  if (!isCarrying(eid)) return 'done';
  if (job.stage === 0) return walkStage(world, eid, job, job.target);
  const carried = carryOf(eid)!;
  world.stock.add(carried.resource, carried.amount);
  clearCarry(eid);
  emit(world, { type: 'stockChanged' });
  return 'done';
};

/** A walkable spot near the Hearthfire (deterministic: world RNG). */
const wanderPoint = (world: GameWorld): Vec2 | null => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = world.rng.next() * Math.PI * 2;
    const radius = world.rng.next() * IDLE_WANDER_RADIUS;
    const { cx, cy } = world.nav.cellOf(
      world.start.x + Math.cos(angle) * radius,
      world.start.y + Math.sin(angle) * radius,
    );
    if (world.nav.walkable(cx, cy)) return world.nav.cellCenter(cx, cy);
  }
  return null;
};

/** Stroll somewhere near the fire, then pause briefly. */
const runIdle: Runner = (world, eid, job) => {
  if (job.stage === 0) {
    if (!job.dest) {
      const spot = wanderPoint(world);
      if (!spot) return 'done';
      job.dest = spot;
    }
    const result = moveTo(world, eid, job.dest);
    if (result === 'failed') return 'done';
    if (result === 'arrived') nextStage(job);
    return 'running';
  }
  job.timer++;
  return job.timer >= IDLE_PAUSE_TICKS + (eid % 20) ? 'done' : 'running';
};

const blueprintAlive = (world: GameWorld, eid: number): boolean =>
  world.obstacles.has(eid) && isBlueprint(world, eid);

/** Fetch materials from a drop point and hand them to a blueprint. */
const runDeliver: Runner = (world, eid, job) => {
  if (!blueprintAlive(world, job.target)) return 'failed';
  const resource = job.resource!;
  switch (job.stage) {
    case 0:
      return walkStage(world, eid, job, job.source!);
    case 1: {
      const taken = world.stock.take(resource, job.amount!);
      if (taken === 0) return 'failed';
      if (taken < job.amount!) {
        releasePending(job.target, resource, job.amount! - taken);
        job.amount = taken;
      }
      setCarry(eid, resource, taken);
      emit(world, { type: 'stockChanged' });
      nextStage(job);
      return 'running';
    }
    case 2:
      return walkStage(world, eid, job, job.target);
    default:
      deliverToBlueprint(world, job.target, resource, job.amount!);
      clearCarry(eid);
      return 'done';
  }
};

/** Work on a fully supplied blueprint until it is finished. */
const runConstruct: Runner = (world, eid, job) => {
  if (!blueprintAlive(world, job.target)) return 'failed';
  if (job.stage === 0) return walkStage(world, eid, job, job.target);
  const def = BUILDINGS[BUILDING_IDS[Building.kind[job.target]!]!];
  Blueprint.progress[job.target] = Blueprint.progress[job.target]! + 1;
  if (Blueprint.progress[job.target]! < def.buildTicks) return 'running';
  completeBlueprint(world, job.target);
  return 'done';
};

/** Replaced in Task 10. */
const notYetImplemented: Runner = () => 'failed';

export const RUNNERS: Record<JobKind, Runner> = {
  harvest: runHarvest,
  haulToDrop: runHaul,
  deliver: runDeliver,
  construct: runConstruct,
  eat: notYetImplemented,
  sleep: notYetImplemented,
  idle: runIdle,
};
