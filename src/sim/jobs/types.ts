import type { ResourceId } from '../../data/resources';
import type { Vec2 } from '../geom';

export type JobKind = 'harvest' | 'haulToDrop' | 'deliver' | 'construct' | 'eat' | 'sleep' | 'idle';

export type JobStatus = 'running' | 'done' | 'failed';

/**
 * A colonist's current job: plain data (serialisable). `stage` indexes the job's own
 * stage machine in runners.ts; `timer` counts work ticks inside a stage; `dest` is
 * the walk destination chosen for the current stage.
 */
export interface Job {
  kind: JobKind;
  /** Doodad, blueprint, building or drop point the job is about. */
  target: number;
  stage: number;
  timer: number;
  dest?: Vec2;
  /** deliver: the drop point to fetch from. */
  source?: number;
  /** deliver: what and how much (reserved as pending on the blueprint). */
  resource?: ResourceId;
  amount?: number;
  /** eat: eating a wild glowcap instead of stored food. */
  wild?: boolean;
}

export const newJob = (kind: JobKind, target: number, extra: Partial<Job> = {}): Job => ({
  kind,
  target,
  stage: 0,
  timer: 0,
  ...extra,
});
