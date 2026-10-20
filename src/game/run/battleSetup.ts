/** Dựng BattleSetup từ RunState (spec §5.3: G1 = cấp 1; §3.6: cấp địch). Thuần, không sửa đầu vào. */
import { ENEMY_LEVEL_STAT } from '../../data/battle';
import {
  MAX_UNITS_PER_BUILDING,
  STRUCT_HP,
  STRUCT_STD,
  THRONE_STD,
  TOWER_RANGE,
  TOWER_STD,
  TROOP_STD,
  levelMult,
} from '../../data/scaling';
import type { AttackSpec, BannerEffect, Level, Scalar, UnitDef } from '../../data/types';
import type { Content } from '../cards/registry';
import type {
  AttackStats,
  BattleSetup,
  StructureSetup,
  UnitStats,
  WaveSetup,
} from '../battle/types';
import { THRONE_PLOT } from './board';
import { collectStatSheet, finalStat, type StatSheet } from './modifiers';
import type { RunState } from './state';

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/**
 * Chỉ số đòn đánh từ `a` sau cấp và modifier. `dmgMult`/`rangeBonus` là hồ sơ cấp (§5.2);
 * `sheet` là modifier §5.3: sát thương, tầm, nhịp (không dưới 50% nhịp gốc).
 */
const attackStats = (a: AttackSpec, dmgMult = 1, rangeBonus = 0, sheet?: StatSheet): AttackStats => {
  const slow = a.onHit?.find((h) => h.type === 'slow');
  const stun = a.onHit?.find((h) => h.type === 'stun');
  const ramp = a.onHit?.find((h) => h.type === 'rampSameTarget');
  const interval = sheet
    ? Math.max(a.interval / (1 + sheet.attackSpeed.pct / 100), a.interval * 0.5)
    : a.interval;
  return {
    dmg: sheet ? finalStat(a.dmg * dmgMult, sheet.dmg) : a.dmg * dmgMult,
    dmgType: a.type,
    range: sheet ? finalStat(a.range + rangeBonus, sheet.range) : a.range + rangeBonus,
    minRange: a.minRange ?? 0,
    interval,
    projectileSpeed: a.projectileSpeed ?? 0,
    cleave: a.cleave ?? 1,
    slowPct: slow ? slow.pct : 0,
    slowTicks: slow ? slow.ticks : 0,
    splash: a.splash ?? 0,
    chain: a.chain ? { ...a.chain } : null,
    stunTicks: stun ? stun.ticks : 0,
    rampPctPerHit: ramp ? ramp.pctPerHit : 0,
    rampCapPct: ramp ? ramp.cap : 0,
  };
};

const scalarAt = (value: Scalar, level: number): number =>
  typeof value === 'number' ? value : value[level - 1]!;

const pctOf = (effects: readonly BannerEffect[], match: (e: BannerEffect) => boolean): number =>
  effects.reduce((sum, e) => (match(e) && 'pct' in e ? sum + e.pct : sum), 0);

/** Lính địch: HP/DMG theo cấp địch, cờ hiệu của vua tấn công (HP, tốc độ, khiên lúc xuất hiện). */
const unitStats = (
  u: UnitDef,
  mult: number,
  siege: boolean,
  content: Content,
  banner: readonly BannerEffect[] = [],
): UnitStats => {
  const hpMult = 1 + pctOf(banner, (e) => e.type === 'enemyStat' && e.stat === 'hp') / 100;
  const speedMult = 1 + pctOf(banner, (e) => e.type === 'enemyStat' && e.stat === 'speed') / 100;
  const hp = u.hp * mult * hpMult;
  const death = u.behaviours?.find((b) => b.type === 'deathSpawn');
  return {
    ...attackStats(u.attack, mult),
    unit: u.id,
    hp,
    speed: u.speed * speedMult,
    radius: u.radius,
    armor: u.armor,
    siege,
    sprite: { w: u.sprite.w, h: u.sprite.h },
    shield: (hp * pctOf(banner, (e) => e.type === 'enemyShieldPct')) / 100,
    deathSpawn: death
      ? { stats: unitStats(content.unit(death.unit), mult, false, content, banner), count: death.count }
      : null,
  };
};

/** Lính của công trình lính ở cấp `level`: HP/DMG theo TROOP_STD rồi modifier, kèm các giới hạn §5.3. */
const spawnedStats = (
  u: UnitDef,
  level: Level,
  sheet: StatSheet,
): UnitStats => {
  const mult = levelMult(TROOP_STD, level);
  const attack = attackStats(u.attack, mult, 0, sheet);
  const baseHp = u.hp * mult;
  return {
    ...attack,
    unit: u.id,
    hp: Math.max(finalStat(baseHp, sheet.hp), baseHp * 0.3),
    speed: Math.max(finalStat(u.speed, sheet.speed), u.speed * 0.3),
    radius: u.radius,
    armor: clamp(finalStat(u.armor, sheet.armor), 0, 0.75),
    siege: false,
    sprite: { w: u.sprite.w, h: u.sprite.h },
    shield: 0,
    deathSpawn: null,
  };
};

const structureFor = (state: RunState, plot: number, content: Content): StructureSetup => {
  const b = state.plots[plot]!.building!;
  const card = content.card(b.cardId);
  const base = { plot, uid: b.uid, cardId: b.cardId } as const;
  if (card.kind === 'throne') {
    const mult = levelMult(THRONE_STD, state.throneLevel);
    const sheet = collectStatSheet(state, content, plot);
    return {
      ...base,
      kind: 'throne',
      hp: Math.max(finalStat(card.hp * mult, sheet.structureHp), card.hp * mult * 0.3),
      armor: clamp(finalStat(card.armor, sheet.armor), 0, 0.75),
      attack: attackStats(card.attack, mult, 0, sheet),
      targeting: 'nearest',
      spawn: null,
      pulse: null,
      taunt: 0,
      shieldPulse: null,
    };
  }
  if (card.kind === 'tome' || card.kind === 'enchantment') {
    throw new Error(`Card ${card.id} cannot be a building`);
  }
  const level = b.level;
  const sheet = collectStatSheet(state, content, plot);
  const hpBase = card.structureHp
    ? card.structureHp[level - 1]!
    : STRUCT_HP[card.kind] * levelMult(STRUCT_STD, level);
  const hp = Math.max(finalStat(hpBase, sheet.structureHp), hpBase * 0.3);
  const armor = card.kind === 'troop' ? 0 : clamp(finalStat(0, sheet.armor), 0, 0.75);
  const spawnFx = card.effects.find((e) => e.type === 'spawn');
  const towerFx = card.effects.find((e) => e.type === 'tower');

  let spawn: StructureSetup['spawn'] = null;
  if (spawnFx && spawnFx.type === 'spawn') {
    const unit = content.unit(spawnFx.unit);
    const unitSheet = collectStatSheet(state, content, plot, unit);
    const raw = Math.floor(finalStat(spawnFx.count[level - 1]!, unitSheet.unitCount));
    const count = state.idleUids.includes(b.uid) ? 0 : clamp(raw, 0, MAX_UNITS_PER_BUILDING);
    const stats = spawnedStats(unit, level, unitSheet);
    const death = unit.behaviours?.find((b) => b.type === 'deathSpawn');
    if (death) {
      const child = content.unit(death.unit);
      stats.deathSpawn = {
        stats: spawnedStats(child, level, collectStatSheet(state, content, plot, child)),
        count: death.count,
      };
    }
    spawn = { stats, count };
  }
  const pulseFx = card.effects.find((e) => e.type === 'pulse');
  const tauntFx = card.effects.find((e) => e.type === 'taunt');
  const shieldFx = card.effects.find((e) => e.type === 'shieldPulse');
  const pulse =
    pulseFx && pulseFx.type === 'pulse'
      ? {
          everyTicks: pulseFx.everyTicks,
          radius: scalarAt(pulseFx.radius, level) + TOWER_RANGE[level - 1]!,
          dmg: finalStat(pulseFx.attack.dmg * levelMult(TOWER_STD, level), sheet.dmg),
          dmgType: pulseFx.attack.type,
          stunTicks:
            pulseFx.attack.onHit?.reduce((m, h) => (h.type === 'stun' ? Math.max(m, h.ticks) : m), 0) ?? 0,
        }
      : null;
  return {
    ...base,
    kind: card.kind as StructureSetup['kind'],
    hp,
    armor,
    attack:
      towerFx && towerFx.type === 'tower'
        ? attackStats(towerFx.attack, levelMult(TOWER_STD, level), TOWER_RANGE[level - 1]!, sheet)
        : null,
    targeting: towerFx && towerFx.type === 'tower' ? towerFx.targeting : 'closestToThrone',
    spawn,
    pulse,
    taunt: tauntFx && tauntFx.type === 'taunt' ? tauntFx.radius : 0,
    shieldPulse:
      shieldFx && shieldFx.type === 'shieldPulse'
        ? {
            everyTicks: shieldFx.everyTicks,
            radius: shieldFx.radius,
            amount: scalarAt(shieldFx.amount, level),
          }
        : null,
  };
};

export function buildBattleSetup(state: RunState, content: Content): BattleSetup {
  const army = state.army;
  if (army === null) throw new Error('buildBattleSetup: state.army is null');

  if (state.plots[THRONE_PLOT]!.building === null) {
    throw new Error('buildBattleSetup: throne plot is empty');
  }

  const structures: StructureSetup[] = [];
  state.plots.forEach((p, plot) => {
    if (plot !== THRONE_PLOT && p.building !== null) structures.push(structureFor(state, plot, content));
  });

  const mult = ENEMY_LEVEL_STAT[army.level - 1]! * army.statMult;
  const banner = army.attacker === 'raiders' ? [] : content.king(army.attacker).banner.effects;
  const waves: WaveSetup[] = army.waves.map((w) => ({
    spawnTick: w.spawnTick,
    spawns: w.units.map((s) => {
      const def = content.unit(s.unit);
      return { stats: unitStats(def, mult, def.tags.includes('siege'), content, banner), edge: s.edge };
    }),
  }));

  return {
    year: state.year,
    throne: structureFor(state, THRONE_PLOT, content),
    structures,
    waves,
    autoFire: state.autoFire,
  };
}
