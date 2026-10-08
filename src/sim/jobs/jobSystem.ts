import { hasComponent, removeComponent } from 'bitecs';
import { isBlueprint, releasePending, reservePending } from '../colony/blueprint';
import { livingColonists } from '../colony/colonists';
import { NEEDS } from '../../data/colonists';
import { Needs, Sleeping } from '../components';
import type { GameWorld } from '../GameWorld';
import { stopMoving } from '../movement/movement';
import { chooseJob, findEat } from './chooseJob';
import { RUNNERS } from './runners';
import type { Job, JobStatus } from './types';

/** Jobs whose target only one colonist may work on at a time. */
const isExclusive = (job: Job): boolean =>
  job.kind === 'harvest' || job.kind === 'construct' || (job.kind === 'eat' && job.wild === true);

export const startJob = (world: GameWorld, eid: number, job: Job): void => {
  world.jobs.set(eid, job);
  if (isExclusive(job)) world.reservations.reserve(job.target, eid);
  if (job.kind === 'deliver') reservePending(job.target, job.resource!, job.amount!);
};

/**
 * Finish or abandon a job: free its reservations, stop walking, wake up, and give a
 * failed delivery's promised amount back to the blueprint. Goods in hand stay in hand
 * (the next job will be hauling them back).
 */
export const endJob = (world: GameWorld, eid: number, job: Job, status: JobStatus): void => {
  world.jobs.delete(eid);
  world.reservations.releaseColonist(eid);
  stopMoving(world, eid);
  const undelivered = job.kind === 'deliver' && status !== 'done' && job.stage < 3;
  if (undelivered && world.obstacles.has(job.target) && isBlueprint(world, job.target)) {
    releasePending(job.target, job.resource!, job.amount!);
  }
  if (hasComponent(world.ecs, eid, Sleeping)) removeComponent(world.ecs, eid, Sleeping);
};

/** Should the current job be dropped for an urgent need? (See the rules above.) */
export const shouldInterrupt = (world: GameWorld, eid: number, job: Job): boolean => {
  if (job.kind === 'haulToDrop' || job.kind === 'eat') return false;
  const starving = Needs.hunger[eid]! < NEEDS.urgent && findEat(world, eid) !== null;
  if (job.kind === 'sleep') return starving;
  return starving || Needs.rest[eid]! < NEEDS.urgent;
};

/** Each living colonist: pick a job if idle, then run one tick of it. */
export const jobSystem = (world: GameWorld): void => {
  for (const eid of [...livingColonists(world)]) {
    let job = world.jobs.get(eid);
    if (job && shouldInterrupt(world, eid, job)) {
      endJob(world, eid, job, 'failed');
      job = undefined;
    }
    if (!job) {
      job = chooseJob(world, eid);
      startJob(world, eid, job);
    }
    const status = RUNNERS[job.kind](world, eid, job);
    if (status !== 'running') endJob(world, eid, job, status);
  }
};
