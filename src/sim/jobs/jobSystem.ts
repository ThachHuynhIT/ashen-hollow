import { hasComponent, removeComponent } from 'bitecs';
import { isBlueprint, releasePending, reservePending } from '../colony/blueprint';
import { livingColonists } from '../colony/colonists';
import { Sleeping } from '../components';
import type { GameWorld } from '../GameWorld';
import { stopMoving } from '../movement/movement';
import { chooseJob } from './chooseJob';
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

/** Each living colonist: pick a job if idle, then run one tick of it. */
export const jobSystem = (world: GameWorld): void => {
  for (const eid of [...livingColonists(world)]) {
    let job = world.jobs.get(eid);
    if (!job) {
      job = chooseJob(world, eid);
      startJob(world, eid, job);
    }
    const status = RUNNERS[job.kind](world, eid, job);
    if (status !== 'running') endJob(world, eid, job, status);
  }
};
