/** Dựng BattleSetup từ RunState (spec §5.3: G1 = cấp 1; §3.6: cấp địch). Thuần, không sửa đầu vào. */
import { EMBER_TICKS, ENEMY_LEVEL_STAT, WAVES } from '../../data/battle';
import { BOSSES } from '../../data/bosses';
import { BOSS_SUMMON_UNITS } from '../../data/raiders';
import { RUN } from '../../data/run';
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
  BossSetup,
  Edge,
  StructureSetup,
  UnitStats,
  WaveSetup,
} from '../battle/types';
import { THRONE_PLOT } from './board';
import { foeSpeedMult, interventionStats } from './decrees';
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
  const listed = (a.onHit ?? []).filter(
    (h) => h.type !== 'slow' && h.type !== 'stun' && h.type !== 'rampSameTarget',
  );
  // Bùa Sóng Ngầm (`knockback` flat): mỗi đòn đẩy lùi thêm, kể cả đòn vốn không đẩy.
  const kbBonus = sheet ? sheet.knockback.flat : 0;
  const kbBase = listed.find((h) => h.type === 'knockback');
  const kbPx = (kbBase && kbBase.type === 'knockback' ? kbBase.px : 0) + kbBonus;
  // Bỏng (§8.6): bỏng gốc cộng Bùa Than Hồng (flat), rồi nhân phần trăm của Lò Cao.
  const burnBase = listed.find((h) => h.type === 'burn');
  const burnDps = sheet
    ? finalStat(burnBase && burnBase.type === 'burn' ? burnBase.dps : 0, sheet.burnDps)
    : burnBase && burnBase.type === 'burn'
      ? burnBase.dps
      : 0;
  const extraOnHit = [
    ...listed.filter((h) => h.type !== 'knockback' && h.type !== 'burn'),
    ...(kbPx > 0 ? [{ type: 'knockback' as const, px: kbPx }] : []),
    ...(burnDps > 0
      ? [{ type: 'burn' as const, dps: burnDps, ticks: burnBase && burnBase.type === 'burn' ? burnBase.ticks : EMBER_TICKS }]
      : []),
  ];
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
    // Bỏng, độc, đẩy, kéo, hút máu, hồi đồng minh, hình quạt: chuyển nguyên vào trận (§5.1).
    ...(extraOnHit.length > 0 ? { onHit: extraOnHit } : {}),
    ...(a.cone ? { cone: { ...a.cone } } : {}),
  };
};

/** Vị trí của đơn vị trong danh sách id đã sắp của registry (khoá bỏng/độc của địch, §8.6). */
const defIndexOf = (content: Content, id: string): number => content.allUnits().findIndex((u) => u.id === id);

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
  speedScale = 1,
): UnitStats => {
  const armorAdd = banner.reduce((sum, e) => (e.type === 'enemyArmor' ? sum + e.add : sum), 0);
  const hpMult = 1 + pctOf(banner, (e) => e.type === 'enemyStat' && e.stat === 'hp') / 100;
  const speedMult = (1 + pctOf(banner, (e) => e.type === 'enemyStat' && e.stat === 'speed') / 100) * speedScale;
  const hp = u.hp * mult * hpMult;
  const death = u.behaviours?.find((b) => b.type === 'deathSpawn');
  return {
    ...attackStats(u.attack, mult),
    unit: u.id,
    hp,
    speed: u.speed * speedMult,
    radius: u.radius,
    armor: clamp(u.armor + armorAdd, 0, 0.75),
    siege,
    sprite: { w: u.sprite.w, h: u.sprite.h },
    shield: (hp * pctOf(banner, (e) => e.type === 'enemyShieldPct')) / 100,
    tags: u.tags,
    behaviours: u.behaviours,
    defIndex: defIndexOf(content, u.id),
    deathSpawn: death
      ? { stats: unitStats(content.unit(death.unit), mult, false, content, banner, speedScale), count: death.count }
      : null,
  };
};

/** Lính của công trình lính ở cấp `level`: HP/DMG theo TROOP_STD rồi modifier, kèm các giới hạn §5.3. */
const spawnedStats = (
  u: UnitDef,
  level: Level,
  sheet: StatSheet,
  content: Content,
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
    tags: u.tags,
    behaviours:
      sheet.rampAs.flat > 0
        ? [...(u.behaviours ?? []), { type: 'rampAttackSpeed' as const, pctPerSecond: sheet.rampAs.flat, cap: sheet.rampAsCap.flat }]
        : u.behaviours,
    defIndex: defIndexOf(content, u.id),
    ...(sheet.prewind.flat > 0 ? { prewind: sheet.prewind.flat } : {}),
  };
};

/** Giây lên dây trước và tăng tốc đánh dần của một công trình (gốc của thẻ cộng Bùa Tích Tắc). */
const timingExtras = (
  sheet: StatSheet,
  effects: readonly { type: string }[],
): Pick<StructureSetup, 'prewind' | 'rampAs'> => {
  const own = effects.find((e) => e.type === 'rampAttackSpeed') as
    | { pctPerSecond: number; cap: number }
    | undefined;
  const pps = (own?.pctPerSecond ?? 0) + sheet.rampAs.flat;
  const cap = (own?.cap ?? 0) + sheet.rampAsCap.flat;
  return {
    ...(sheet.prewind.flat > 0 ? { prewind: sheet.prewind.flat } : {}),
    ...(pps > 0 ? { rampAs: { pps, cap } } : {}),
  };
};

/** Số lính Đàn Tế triệu hồi đầu trận: lễ vật × hệ số theo cấp, không quá giới hạn theo cấp. */
const altarCount = (
  fx: { perOffering: Scalar; cap: Scalar },
  offerings: number,
  level: number,
): number => Math.min(scalarAt(fx.cap, level), offerings * scalarAt(fx.perOffering, level));

/** Lính triệu hồi do hiệu ứng tạo ra: chỉ số của cấp công trình, gắn thẻ `summon`. */
const summonStats = (state: RunState, content: Content, plot: number, unitId: string, level: Level): UnitStats => {
  const unit = content.unit(unitId);
  const stats = spawnedStats(unit, level, collectStatSheet(state, content, plot, unit), content);
  return { ...stats, tags: [...unit.tags, 'summon'] };
};

/** Lính đánh thuê của Hợp Đồng (`counters.privateers` của Ngai) sinh thêm tại Ngai đầu trận. */
const throneMercenaries = (
  state: RunState,
  content: Content,
  count: number,
): Pick<StructureSetup, 'spawnAtThrone'> => {
  if (count <= 0) return {};
  const unit = content.unit('mercenary');
  const sheet = collectStatSheet(state, content, THRONE_PLOT, unit);
  return { spawnAtThrone: { stats: spawnedStats(unit, state.throneLevel, sheet, content), count } };
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
      ...throneMercenaries(state, content, b.counters.privateers ?? 0),
      ...timingExtras(sheet, []),
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
    const stats = spawnedStats(unit, level, unitSheet, content);
    const death = unit.behaviours?.find((b) => b.type === 'deathSpawn');
    if (death) {
      const child = content.unit(death.unit);
      stats.deathSpawn = {
        stats: spawnedStats(child, level, collectStatSheet(state, content, plot, child), content),
        count: death.count,
      };
    }
    spawn = { stats, count };
  }
  const pulseFx = card.effects.find((e) => e.type === 'pulse');
  const tauntFx = card.effects.find((e) => e.type === 'taunt');
  const shieldFx = card.effects.find((e) => e.type === 'shieldPulse');
  const pulseKnock =
    pulseFx && pulseFx.type === 'pulse'
      ? (pulseFx.attack.onHit?.reduce((m, h) => (h.type === 'knockback' ? Math.max(m, h.px) : m), 0) ?? 0)
      : 0;
  const pulse =
    pulseFx && pulseFx.type === 'pulse'
      ? {
          everyTicks: pulseFx.everyTicks,
          radius: scalarAt(pulseFx.radius, level) + TOWER_RANGE[level - 1]!,
          dmg: finalStat(pulseFx.attack.dmg * levelMult(TOWER_STD, level), sheet.dmg),
          dmgType: pulseFx.attack.type,
          stunTicks:
            pulseFx.attack.onHit?.reduce((m, h) => (h.type === 'stun' ? Math.max(m, h.ticks) : m), 0) ?? 0,
          ...(pulseKnock > 0 ? { knockback: pulseKnock } : {}),
        }
      : null;
  const killSummonFx = card.effects.find((e) => e.type === 'summonOnKill');
  const summonFx = card.effects.find((e) => e.type === 'summonEvery');
  const altarFx = card.effects.find((e) => e.type === 'altarSummon');
  const auraFx = card.effects.find((e) => e.type === 'healAura');
  const bellFx = card.effects.find((e) => e.type === 'bellPulse');
  const respawnFx = card.effects.find((e) => e.type === 'respawnLost');
  const multiFx = card.effects.find((e) => e.type === 'multiAttack');
  const goldFx = card.effects.find((e) => e.type === 'killGold');
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
    ...(auraFx && auraFx.type === 'healAura'
      ? { healAura: { radius: auraFx.radius, hps: scalarAt(auraFx.hpPerSec, level) } }
      : {}),
    ...(multiFx && multiFx.type === 'multiAttack' ? { multiAttack: multiFx.count } : {}),
    ...timingExtras(sheet, card.effects),
    ...(killSummonFx && killSummonFx.type === 'summonOnKill'
      ? {
          summonOnKill: {
            stats: summonStats(state, content, plot, killSummonFx.unit, level),
            max: scalarAt(killSummonFx.max, level),
          },
        }
      : {}),
    ...(summonFx && summonFx.type === 'summonEvery'
      ? {
          summonEvery: {
            everyTicks: scalarAt(summonFx.everyTicks, level),
            stats: summonStats(state, content, plot, summonFx.unit, level),
            max: scalarAt(summonFx.maxPerBattle, level),
          },
        }
      : {}),
    ...(altarFx && altarFx.type === 'altarSummon' && altarCount(altarFx, b.counters.offerings ?? 0, level) > 0
      ? {
          startSummon: {
            stats: summonStats(state, content, plot, altarFx.unit, level),
            count: altarCount(altarFx, b.counters.offerings ?? 0, level),
          },
        }
      : {}),
    ...(bellFx && bellFx.type === 'bellPulse'
      ? {
          bell: {
            everyTicks: bellFx.everyTicks,
            radius: bellFx.radius,
            pct: scalarAt(bellFx.attackSpeedPct, level),
            ticks: bellFx.buffTicks,
            stun: level >= bellFx.stunFromLevel ? bellFx.stunTicks : 0,
          },
        }
      : {}),
    ...(respawnFx && respawnFx.type === 'respawnLost' && spawn && spawn.count > 0
      ? { respawn: { everyTicks: respawnFx.everyTicks, stats: spawn.stats, count: spawn.count } }
      : {}),
    ...(goldFx && goldFx.type === 'killGold'
      ? { killGold: { every: goldFx.every, gold: goldFx.gold, max: goldFx.max } }
      : {}),
  };
};

/** Mép đầu tiên của đợt 2 (nơi boss xuất hiện); nếu đợt 2 trống thì mép đầu tiên có quân, rồi `N`. */
const bossEdge = (army: NonNullable<RunState['army']>): Edge => {
  const second = army.waves[1]?.units[0]?.edge;
  if (second !== undefined) return second;
  for (const wave of army.waves) if (wave.units[0] !== undefined) return wave.units[0].edge;
  return 'N';
};

/**
 * Boss của năm (§7.3): HP nhân `1 + difficultyBudgetStep × gai` (không nhân hệ số cấp địch), quân triệu hồi
 * và Bóng Gương (boss 3) dựng sẵn để trận không tra registry.
 */
const bossSetup = (
  state: RunState,
  army: NonNullable<RunState['army']>,
  content: Content,
  structures: readonly StructureSetup[],
  speedScale: number,
): BossSetup | undefined => {
  if (army.boss === undefined) return undefined;
  const def = BOSSES.find((b) => b.id === army.boss);
  if (def === undefined) throw new Error(`Unknown boss ${army.boss}`);
  const stats = unitStats(def.unit, 1, def.unit.tags.includes('siege'), content, [], speedScale);
  stats.hp = def.unit.hp * (1 + RUN.difficultyBudgetStep * state.difficulty);
  const summons: Record<string, UnitStats> = {};
  for (const u of BOSS_SUMMON_UNITS) summons[u.id] = unitStats(u, 1, false, content, [], speedScale);

  let mirror: BossSetup['mirror'] = null;
  if (def.ordinal === 3) {
    let best: StructureSetup | null = null;
    for (const s of structures) {
      if (s.kind !== 'troop' || s.spawn === null) continue;
      const level = state.plots[s.plot]!.building!.level;
      const bestLevel = best === null ? 0 : state.plots[best.plot]!.building!.level;
      if (level > bestLevel || (level === bestLevel && best !== null && s.plot < best.plot)) best = s;
    }
    if (best !== null) {
      const unit = content.unit(best.spawn!.stats.unit);
      const mult = ENEMY_LEVEL_STAT[army.level - 1]! * army.statMult;
      mirror = {
        stats: unitStats(unit, mult, false, content, [], speedScale),
        count: Math.max(1, Math.floor(best.spawn!.count / 2)),
      };
    }
  }
  return { id: def.id, ordinal: def.ordinal, spawnTick: WAVES.spawnTick[1], edge: bossEdge(army), stats, summons, mirror };
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
  const bannerDef =
    army.attacker === 'raiders' || army.attacker === 'coalition' || army.attacker === 'boss'
      ? null
      : content.enemyKing(army.attacker).banner;
  const banner = bannerDef?.effects ?? [];
  const speedScale = foeSpeedMult(state);
  const waves: WaveSetup[] = army.waves.map((w) => ({
    spawnTick: w.spawnTick,
    spawns: w.units.map((s) => {
      const def = content.unit(s.unit);
      return {
        stats: unitStats(def, mult, def.tags.includes('siege'), content, banner, speedScale),
        edge: s.edge,
      };
    }),
  }));

  const boss = bossSetup(state, army, content, structures, speedScale);

  return {
    year: state.year,
    throne: structureFor(state, THRONE_PLOT, content),
    structures,
    waves,
    autoFire: state.autoFire,
    ...(bannerDef ? { banner: bannerDef } : {}),
    ...(boss ? { boss } : {}),
    // Vắng khi không có sắc lệnh/nhiệm vụ: trận giữ số gốc §7.4 (G1/G2).
    ...(state.decrees.length > 0 || state.interventionDmgPct > 0
      ? { intervention: interventionStats(state) }
      : {}),
  };
}
