import { INTERVENTION } from '../../data/battle';
import { TICKS_PER_SECOND } from '../../core/SimClock';
import { KIND_UNIT, TEAM_FOE, type BattleWorld } from '../../game/battle/world';

/**
 * Pure read-outs of a running battle for the battle HUD (§10.7). They only read the world;
 * the HUD never changes it (interventions go through `ui:intervene`).
 */

/** Enemies still to beat: foe units alive now plus every unit of the waves not yet spawned. */
export const foesRemaining = (world: BattleWorld): number => {
  let n = 0;
  for (let id = 0; id < world.count; id++) {
    if (world.alive[id] === 1 && world.team[id] === TEAM_FOE && world.kind[id] === KIND_UNIT) n++;
  }
  const waves = world.setup.waves;
  for (let i = world.spawnedWaves; i < waves.length; i++) n += waves[i]!.spawns.length;
  return n;
};

/** Throne HP as 0..1 (0 once destroyed). */
export const throneHpFraction = (world: BattleWorld): number => {
  const max = world.maxHp[world.throneId]!;
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, world.hp[world.throneId]! / max));
};

export interface InterventionCooldown {
  ready: boolean;
  /** 0..1 of the current wait still to go (0 when ready). */
  fraction: number;
  /** Whole seconds left, rounded up (0 when ready). */
  seconds: number;
}

/**
 * Royal Boulder readiness (§7.4): usable once `tick ≥ readyTick` (which starts at
 * `firstReadyTick`); the wait is `firstReadyTick` before the first drop, `cooldownTicks` after.
 */
export const interventionCooldown = (world: BattleWorld): InterventionCooldown => {
  const readyAt = Math.max(INTERVENTION.firstReadyTick, world.readyTick);
  const left = readyAt - world.tick;
  if (left <= 0 || world.ended) return { ready: left <= 0, fraction: 0, seconds: 0 };
  const total =
    world.interventionsUsed > 0 ? INTERVENTION.cooldownTicks : INTERVENTION.firstReadyTick;
  return {
    ready: false,
    fraction: Math.min(1, left / total),
    seconds: Math.ceil(left / TICKS_PER_SECOND),
  };
};
