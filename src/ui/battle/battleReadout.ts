import { INTERVENTION } from '../../data/battle';
import { BOSSES } from '../../data/bosses';
import { bossPhase } from '../../game/battle/bosses';
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

export interface SummaryInput {
  kills: number;
  lives: number;
  /** Battle length already formatted ("m:ss"). */
  time: string;
  /** Gold the battle paid (prize and conquest bonus); 0 = none shown. */
  goldGain: number;
  /** Display name of the king conquered by this battle, if any. */
  conquered: string | null;
}

/** The lines of the post-battle summary panel (§10.7). */
export const summaryLines = (s: SummaryInput): string[] => [
  `Địch đã hạ: ${s.kills}`,
  `Mạng còn: ${s.lives}`,
  `Thời gian: ${s.time}`,
  ...(s.goldGain > 0 ? [`Vàng nhận: +${s.goldGain}`] : []),
  ...(s.conquered !== null ? [`Đã chinh phục ${s.conquered}!`] : []),
];

export interface BossReadout {
  nameVi: string;
  hp: number;
  maxHp: number;
  /** The skill phase now, in Vietnamese (e.g. "Cuồng Vương"). */
  phase: string;
}

/**
 * The boss bar of the battle HUD: name, current / max HP and which skill phase it is in. `null`
 * until the boss has appeared and again once it is dead.
 */
export const bossReadout = (world: BattleWorld): BossReadout | null => {
  const setup = world.setup.boss;
  const id = world.bossId;
  if (setup === undefined || id < 0 || world.alive[id] === 0) return null;
  const def = BOSSES.find((b) => b.id === setup.id);
  const phase =
    setup.ordinal === 1
      ? world.bossFrogsCalled
        ? 'Ếch tràn ra'
        : 'Ném Bùn'
      : setup.ordinal === 2
        ? world.bossLanded
          ? 'Hạ Cánh'
          : 'Đàn Ong'
        : { mirror: 'Bóng Gương', shield: 'Khiên Ngai Vỡ', rage: 'Cuồng Vương', none: 'Vua Không Ngai' }[bossPhase(world) ?? 'none'];
  return {
    nameVi: def?.unit.nameVi ?? 'Boss',
    hp: Math.max(0, Math.ceil(world.hp[id]!)),
    maxHp: Math.round(world.maxHp[id]!),
    phase,
  };
};
