import { describe, expect, it } from 'vitest';
import { BATTLE, INTERVENTION, SPAWN_OFFSETS } from '../../data/battle';
import { battleSetup, structure, unitStats } from '../testing/fixtures';
import { hashWorld } from './hash';
import type { Edge, WaveSetup } from './types';
import {
  KIND_STRUCTURE,
  KIND_THRONE,
  KIND_UNIT,
  TEAM_ALLY,
  TEAM_FOE,
  createBattle,
  drainEvents,
  edgePositions,
  plotCenter,
  spawnWave,
} from './world';

const barracks = (plot: number, count: number) =>
  structure(plot, { uid: 100 + plot, spawn: { stats: unitStats({ unit: 'militia' }), count } });

const wave = (n: number, edge: Edge = 'N', spawnTick = 0): WaveSetup => ({
  spawnTick,
  spawns: Array.from({ length: n }, () => ({ stats: unitStats({ unit: 'bandit' }), edge })),
});

describe('plotCenter', () => {
  it('maps plots to board cell centres', () => {
    expect(plotCenter(12)).toEqual({ x: 192, y: 192 });
    expect(plotCenter(7)).toEqual({ x: 192, y: 160 });
    expect(plotCenter(0)).toEqual({ x: 128, y: 128 });
  });
});

describe('createBattle', () => {
  it('places the throne at id 0, then structures by plot, then their troops', () => {
    const w = createBattle(
      battleSetup({ structures: [barracks(7, 3), structure(3, { uid: 9, kind: 'tower' })] }),
    );
    expect(w.throneId).toBe(0);
    expect(w.kind[0]).toBe(KIND_THRONE);
    expect([w.x[0], w.y[0]]).toEqual([192, 192]);
    expect(w.team[0]).toBe(TEAM_ALLY);
    expect(w.radius[0]).toBe(BATTLE.throneRadius);
    // plot 3 before plot 7 regardless of setup order
    expect(w.kind[1]).toBe(KIND_STRUCTURE);
    expect(w.label[1]).toBe('neutral_barracks');
    expect(w.sourceUid[1]).toBe(9);
    expect([w.x[1], w.y[1]]).toEqual([plotCenter(3).x, plotCenter(3).y]);
    expect(w.sourceUid[2]).toBe(107);
    expect(w.radius[2]).toBe(BATTLE.structureRadius);
    expect(w.speed[2]).toBe(0);
    const pos: [number, number][] = [];
    for (let id = 3; id < 6; id++) {
      expect(w.kind[id]).toBe(KIND_UNIT);
      expect(w.team[id]).toBe(TEAM_ALLY);
      expect(w.alive[id]).toBe(1);
      expect(w.cooldown[id]).toBe(0);
      expect(w.target[id]).toBe(-1);
      expect(w.label[id]).toBe('militia');
      expect(w.hp[id]).toBe(40);
      expect(w.maxHp[id]).toBe(40);
      expect(w.homeX[id]).toBe(192);
      expect(w.homeY[id]).toBe(160);
      expect(w.sourceUid[id]).toBe(107);
      pos.push([w.x[id]!, w.y[id]!]);
    }
    expect(pos).toEqual([
      [192, 152],
      [200, 160],
      [192, 168],
    ]);
    expect(w.count).toBe(6);
    expect(w.tick).toBe(0);
    expect(w.readyTick).toBe(INTERVENTION.firstReadyTick);
    expect(w.boulders).toEqual([]);
    expect(w.damageQueue).toEqual([]);
    expect([w.ended, w.won, w.endTick]).toEqual([false, false, -1]);
    for (let id = 0; id < w.count; id++) expect(w.killerUid[id]).toBe(-1);
    const spawned = w.events.filter((e) => e.type === 'spawn').map((e) => (e as { id: number }).id);
    expect(spawned).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('copies throne and unit stats into the arrays', () => {
    const w = createBattle(
      battleSetup({
        structures: [
          structure(7, {
            spawn: {
              stats: unitStats({
                dmg: 9,
                dmgType: 'fire',
                range: 30,
                minRange: 5,
                interval: 12,
                projectileSpeed: 6,
                cleave: 2,
                slowPct: 20,
                slowTicks: 15,
                speed: 1.5,
                radius: 5,
                armor: 0.25,
                siege: true,
              }),
              count: 1,
            },
          }),
        ],
      }),
    );
    expect(w.range[0]).toBe(72);
    expect(w.targeting[0]).toBe(0); // nearest
    expect(w.targeting[1]).toBe(1); // closestToThrone
    const u = 2;
    expect([w.dmg[u], w.dmgType[u], w.range[u], w.minRange[u], w.interval[u]]).toEqual([
      9, 1, 30, 5, 12,
    ]);
    expect([w.projSpeed[u], w.cleave[u], w.onHitSlowPct[u], w.onHitSlowTicks[u]]).toEqual([
      6, 2, 20, 15,
    ]);
    expect([w.speed[u], w.radius[u], w.armor[u], w.siege[u]]).toEqual([1.5, 5, 0.25, 1]);
    expect([w.slowPct[u], w.slowTicks[u], w.kbTicks[u]]).toEqual([0, 0, 0]);
    expect([w.prevX[u], w.prevY[u]]).toEqual([w.x[u], w.y[u]]);
  });

  it('second ring of spawn offsets is scaled by 1.5 and rounded', () => {
    const w = createBattle(battleSetup({ structures: [barracks(7, 20)] }));
    const first = 2; // throne, barracks
    const k = 16;
    expect(w.x[first + k]! - 192).toBe(0);
    expect(w.y[first + k]! - 160).toBe(-12);
    const [ox, oy] = SPAWN_OFFSETS[19 % 16]!;
    expect(w.x[first + 19]! - 192).toBe(Math.round(ox * 1.5));
    expect(w.y[first + 19]! - 160).toBe(Math.round(oy * 1.5));
  });

  it('every offset of the second ring and beyond uses the 1.5× multiplier', () => {
    const w = createBattle(battleSetup({ structures: [barracks(7, 33)] }));
    const first = 2;
    for (let k = 0; k < 33; k++) {
      const [ox, oy] = SPAWN_OFFSETS[k % 16]!;
      const m = k < 16 ? 1 : 1.5;
      expect([w.x[first + k]! - 192, w.y[first + k]! - 160]).toEqual([
        Math.round(ox * m),
        Math.round(oy * m),
      ]);
    }
    // k = 32 reuses the 1.5× ring (not 2.25×)
    expect([w.x[first + 32]! - 192, w.y[first + 32]! - 160]).toEqual([0, -12]);
  });

  it('does not depend on the order of structures', () => {
    const list = [
      barracks(3, 4),
      barracks(7, 5),
      structure(11, { kind: 'tower' }),
      barracks(20, 2),
    ];
    const a = createBattle(battleSetup({ structures: list }));
    const b = createBattle(battleSetup({ structures: [...list].reverse() }));
    expect(hashWorld(a)).toBe(hashWorld(b));
  });

  it('caps player units at playerUnitCap and never writes past entityCap', () => {
    const plots = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const w = createBattle(
      battleSetup({
        structures: plots.map((p) => barracks(p, 20)),
        waves: [wave(150), wave(150, 'S'), wave(150, 'E')],
      }),
    );
    let allies = 0;
    for (let id = 0; id < w.count; id++)
      if (w.kind[id] === KIND_UNIT && w.team[id] === TEAM_ALLY) allies++;
    expect(allies).toBe(BATTLE.playerUnitCap);
    expect(w.capped).toBe(20);
    expect(w.count).toBe(1 + 9 + 160);

    spawnWave(w, 0);
    spawnWave(w, 1);
    expect(w.count).toBe(470);
    const before = w.count;
    expect(() => spawnWave(w, 2)).not.toThrow();
    expect(w.count).toBe(BATTLE.entityCap);
    let foes = 0;
    for (let id = before; id < w.count; id++) if (w.team[id] === TEAM_FOE) foes++;
    expect(foes).toBe(BATTLE.entityCap - before);
    expect(w.x.length).toBe(BATTLE.entityCap);
    expect(w.label.length).toBe(BATTLE.entityCap);
    expect(w.addEntity()).toBe(-1);
  });
});

describe('edgePositions', () => {
  it('lays units out centred on the edge midpoint, outside the field', () => {
    expect(edgePositions('N', 3)).toEqual([
      { x: 182, y: -12 },
      { x: 192, y: -12 },
      { x: 202, y: -12 },
    ]);
    expect(edgePositions('S', 1)).toEqual([{ x: 192, y: 396 }]);
    const e = edgePositions('E', 2);
    expect(e.map((p) => p.x)).toEqual([396, 396]);
    expect(e.map((p) => p.y)).toEqual([187, 197]);
    expect(edgePositions('W', 1)[0]!.x).toBe(-12);
  });

  it('starts a new row further out when a row is full', () => {
    const p = edgePositions('N', 25);
    expect(p.filter((q) => q.y === -12)).toHaveLength(24);
    expect(p.filter((q) => q.y === -22)).toEqual([{ x: 192, y: -22 }]);
    expect(edgePositions('W', 25)[24]).toEqual({ x: -22, y: 192 });
  });
});

describe('spawnWave', () => {
  it('spawns foes on their edges, in order, with sourceUid −1', () => {
    const setup = battleSetup({
      waves: [
        {
          spawnTick: 0,
          spawns: [
            { stats: unitStats({ unit: 'bandit' }), edge: 'S' },
            { stats: unitStats({ unit: 'ogre', hp: 90 }), edge: 'N' },
            { stats: unitStats({ unit: 'bandit' }), edge: 'S' },
          ],
        },
      ],
    });
    const w = createBattle(setup);
    drainEvents(w);
    expect(w.spawnedWaves).toBe(0);
    spawnWave(w, 0);
    expect(w.spawnedWaves).toBe(1);
    expect(w.count).toBe(4);
    for (let id = 1; id < 4; id++) {
      expect(w.team[id]).toBe(TEAM_FOE);
      expect(w.kind[id]).toBe(KIND_UNIT);
      expect(w.sourceUid[id]).toBe(-1);
      expect(w.alive[id]).toBe(1);
    }
    expect([w.x[1], w.y[1]]).toEqual([187, 396]);
    expect([w.x[2], w.y[2]]).toEqual([192, -12]);
    expect([w.x[3], w.y[3]]).toEqual([197, 396]);
    expect(w.label[2]).toBe('ogre');
    expect(w.hp[2]).toBe(90);
    const events = drainEvents(w);
    expect(events).toContainEqual({ type: 'waveSpawned', index: 0, edges: ['S', 'N'] });
    expect(events.filter((e) => e.type === 'spawn')).toHaveLength(3);
    expect(w.events).toEqual([]);
    expect(drainEvents(w)).toEqual([]);
  });
});

describe('hashWorld', () => {
  it('is equal for equal worlds and changes with state', () => {
    const setup = battleSetup({ structures: [barracks(7, 3)] });
    const a = createBattle(setup);
    const b = createBattle(setup);
    expect(hashWorld(a)).toBe(hashWorld(b));
    a.x[1] = a.x[1]! + 1;
    expect(hashWorld(a)).not.toBe(hashWorld(b));
  });

  const ENTITY_ARRAYS = [
    'x',
    'y',
    'prevX',
    'prevY',
    'hp',
    'maxHp',
    'dmg',
    'range',
    'minRange',
    'interval',
    'cooldown',
    'speed',
    'radius',
    'armor',
    'slowPct',
    'projSpeed',
    'cleave',
    'onHitSlowPct',
    'homeX',
    'homeY',
    'kbX',
    'kbY',
    'team',
    'kind',
    'alive',
    'siege',
    'target',
    'slowTicks',
    'onHitSlowTicks',
    'sourceUid',
    'kbTicks',
    'targeting',
    'killerUid',
    'dmgType',
  ] as const;
  const PROJECTILE_ARRAYS = [
    'px',
    'py',
    'speed',
    'dmg',
    'slowPct',
    'slowTicks',
    'targetId',
    'sourceId',
    'sourceUid',
    'dmgType',
    'alive',
  ] as const;

  const withProjectile = () => {
    const w = createBattle(battleSetup({ structures: [barracks(7, 3)] }));
    const p = w.projectiles;
    p.px[0] = 10;
    p.py[0] = 20;
    p.speed[0] = 8;
    p.dmg[0] = 5;
    p.targetId[0] = 2;
    p.sourceId[0] = 0;
    p.alive[0] = 1;
    w.projectileCount = 1;
    return w;
  };

  it.each(ENTITY_ARRAYS)('changes when entity array %s changes', (field) => {
    const w = withProjectile();
    const h = hashWorld(w);
    const a = w[field];
    a[w.count - 1] = a[w.count - 1]! + 1;
    expect(hashWorld(w)).not.toBe(h);
  });

  it.each(PROJECTILE_ARRAYS)('changes when projectile array %s changes', (field) => {
    const w = withProjectile();
    const h = hashWorld(w);
    const a = w.projectiles[field];
    a[0] = a[0]! + 1;
    expect(hashWorld(w)).not.toBe(h);
  });

  it('ignores slots beyond count and projectileCount', () => {
    const w = withProjectile();
    const h = hashWorld(w);
    w.x[w.count] = 99;
    w.projectiles.px[1] = 99;
    expect(hashWorld(w)).toBe(h);
  });

  it.each(['readyTick', 'spawnedWaves', 'interventionsUsed', 'playerUnits', 'endTick'] as const)(
    'changes when %s changes',
    (field) => {
      const w = withProjectile();
      const h = hashWorld(w);
      w[field] += 1;
      expect(hashWorld(w)).not.toBe(h);
    },
  );

  it.each(['ended', 'won'] as const)('changes when %s flips', (field) => {
    const w = withProjectile();
    const h = hashWorld(w);
    w[field] = !w[field];
    expect(hashWorld(w)).not.toBe(h);
  });

  it('covers boulders', () => {
    const w = withProjectile();
    const h0 = hashWorld(w);
    w.boulders.push({ x: 100, y: 120, dropTick: 30, impactTick: 36 });
    const h1 = hashWorld(w);
    expect(h1).not.toBe(h0);
    for (const key of ['x', 'y', 'dropTick', 'impactTick'] as const) {
      w.boulders[0]![key] += 1;
      expect(hashWorld(w)).not.toBe(h1);
      w.boulders[0]![key] -= 1;
    }
    expect(hashWorld(w)).toBe(h1);
  });

  it('covers tick and projectileCount', () => {
    const setup = battleSetup();
    const a = createBattle(setup);
    const h = hashWorld(a);
    a.tick = 1;
    expect(hashWorld(a)).not.toBe(h);
    a.tick = 0;
    a.projectileCount = 1;
    expect(hashWorld(a)).not.toBe(h);
  });
});
