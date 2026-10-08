import { addComponent, hasComponent } from 'bitecs';
import { NEEDS } from '../../data/colonists';
import { Dead, Needs, Sleeping } from '../components';
import { emit } from '../events';
import type { GameWorld } from '../GameWorld';
import { endJob } from '../jobs/jobSystem';
import { clearCarry, livingColonists } from './colonists';

const clamp = (v: number): number => Math.max(0, Math.min(100, v));

/** Mark a colonist dead: drop everything (goods are lost) and report it. */
export const killColonist = (
  world: GameWorld,
  eid: number,
  cause: 'hunger' | 'exhaustion',
): void => {
  const job = world.jobs.get(eid);
  if (job) endJob(world, eid, job, 'failed');
  world.reservations.releaseColonist(eid);
  clearCarry(eid);
  addComponent(world.ecs, eid, Dead);
  emit(world, { type: 'colonistDied', eid, cause });
};

/** Hunger and rest drain over time; neglect drains health; health 0 is death. */
export const needsSystem = (world: GameWorld): void => {
  for (const eid of [...livingColonists(world)]) {
    Needs.hunger[eid] = clamp(Needs.hunger[eid]! - NEEDS.hungerPerTick);
    if (hasComponent(world.ecs, eid, Sleeping)) {
      const factor = Sleeping.inTent[eid] ? 1 : NEEDS.outdoorSleepFactor;
      Needs.rest[eid] = clamp(Needs.rest[eid]! + NEEDS.sleepRestorePerTick * factor);
    } else {
      Needs.rest[eid] = clamp(Needs.rest[eid]! - NEEDS.restPerTick);
    }
    const starving = Needs.hunger[eid]! <= 0;
    const exhausted = Needs.rest[eid]! <= 0;
    if (starving || exhausted) {
      Needs.health[eid] = clamp(Needs.health[eid]! - NEEDS.healthLossPerTick);
    } else if (Needs.hunger[eid]! > NEEDS.healthyAbove && Needs.rest[eid]! > NEEDS.healthyAbove) {
      Needs.health[eid] = clamp(Needs.health[eid]! + NEEDS.healthGainPerTick);
    }
    if (Needs.health[eid]! <= 0) killColonist(world, eid, starving ? 'hunger' : 'exhaustion');
  }
};
