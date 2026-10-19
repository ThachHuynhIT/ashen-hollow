/** Dựng BattleSetup từ RunState (spec §5.3: G1 = cấp 1; §3.6: cấp địch). Thuần, không sửa đầu vào. */
import { ENEMY_LEVEL_STAT } from '../../data/battle';
import { STRUCT_HP } from '../../data/scaling';
import type { AttackSpec, EffectDef, UnitDef } from '../../data/types';
import type { Content } from '../cards/registry';
import type {
  AttackStats,
  BattleSetup,
  StructureSetup,
  UnitStats,
  WaveSetup,
} from '../battle/types';
import { THRONE_PLOT } from './board';
import type { BuildingState, RunState } from './state';

const attackStats = (a: AttackSpec, mult = 1): AttackStats => {
  const slow = a.onHit?.find((h) => h.type === 'slow');
  return {
    dmg: a.dmg * mult,
    dmgType: a.type,
    range: a.range,
    minRange: a.minRange ?? 0,
    interval: a.interval,
    projectileSpeed: a.projectileSpeed ?? 0,
    cleave: a.cleave ?? 1,
    slowPct: slow ? slow.pct : 0,
    slowTicks: slow ? slow.ticks : 0,
  };
};

const unitStats = (u: UnitDef, mult: number, siege: boolean): UnitStats => ({
  ...attackStats(u.attack, mult),
  unit: u.id,
  hp: u.hp * mult,
  speed: u.speed,
  radius: u.radius,
  armor: u.armor,
  siege,
  sprite: { w: u.sprite.w, h: u.sprite.h },
});

const structureFor = (plot: number, b: BuildingState, content: Content): StructureSetup => {
  const card = content.card(b.cardId);
  const base = { plot, uid: b.uid, cardId: b.cardId, armor: 0 } as const;
  if (card.kind === 'throne') {
    return {
      ...base,
      kind: 'throne',
      hp: card.hp,
      armor: card.armor,
      attack: attackStats(card.attack),
      targeting: 'nearest',
      spawn: null,
    };
  }
  if (card.kind !== 'troop' && card.kind !== 'tower') {
    throw new Error(`Card ${card.id} cannot be a building`);
  }
  const hp = card.structureHp ? card.structureHp[b.level - 1]! : STRUCT_HP[card.kind];
  const effects: readonly EffectDef[] = card.effects;
  const spawnFx = effects.find((e) => e.type === 'spawn');
  const towerFx = effects.find((e) => e.type === 'tower');
  return {
    ...base,
    kind: card.kind,
    hp,
    attack: towerFx && towerFx.type === 'tower' ? attackStats(towerFx.attack) : null,
    targeting: towerFx && towerFx.type === 'tower' ? towerFx.targeting : 'closestToThrone',
    spawn:
      spawnFx && spawnFx.type === 'spawn'
        ? {
            stats: unitStats(content.unit(spawnFx.unit), 1, false),
            count: spawnFx.count[b.level - 1]!,
          }
        : null,
  };
};

export function buildBattleSetup(state: RunState, content: Content): BattleSetup {
  const army = state.army;
  if (army === null) throw new Error('buildBattleSetup: state.army is null');

  const throneBuilding = state.plots[THRONE_PLOT]!.building;
  if (throneBuilding === null) throw new Error('buildBattleSetup: throne plot is empty');

  const structures: StructureSetup[] = [];
  state.plots.forEach((p, plot) => {
    if (plot !== THRONE_PLOT && p.building !== null) {
      structures.push(structureFor(plot, p.building, content));
    }
  });

  const mult = ENEMY_LEVEL_STAT[army.level - 1]! * army.statMult;
  const waves: WaveSetup[] = army.waves.map((w) => ({
    spawnTick: w.spawnTick,
    spawns: w.units.map((s) => {
      const def = content.unit(s.unit);
      return { stats: unitStats(def, mult, def.tags.includes('siege')), edge: s.edge };
    }),
  }));

  return {
    year: state.year,
    throne: structureFor(THRONE_PLOT, throneBuilding, content),
    structures,
    waves,
  };
}
