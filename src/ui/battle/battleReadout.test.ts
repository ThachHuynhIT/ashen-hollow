import { describe, expect, it } from 'vitest';
import { INTERVENTION } from '../../data/battle';
import { tryIntervene } from '../../game/battle/intervention';
import { createBattle, spawnWave } from '../../game/battle/world';
import { battleSetup, unitStats } from '../../game/testing/fixtures';
import { bossWorld, realBoss } from '../../game/battle/bossKit';
import { bossReadout, foesRemaining, interventionCooldown, summaryLines, throneHpFraction } from './battleReadout';

const threeWaves = () =>
  battleSetup({
    waves: [
      {
        spawnTick: 0,
        spawns: [
          { stats: unitStats(), edge: 'N' },
          { stats: unitStats(), edge: 'E' },
        ],
      },
      { spawnTick: 120, spawns: [{ stats: unitStats(), edge: 'S' }] },
      {
        spawnTick: 240,
        spawns: [
          { stats: unitStats(), edge: 'W' },
          { stats: unitStats(), edge: 'W' },
        ],
      },
    ],
  });

describe('foesRemaining', () => {
  it('counts unspawned waves and living foes', () => {
    const w = createBattle(threeWaves());
    expect(foesRemaining(w)).toBe(5);
    spawnWave(w, 0);
    expect(foesRemaining(w)).toBe(5);
    w.alive[w.count - 1] = 0;
    expect(foesRemaining(w)).toBe(4);
  });
});

describe('throneHpFraction', () => {
  it('is hp / maxHp clamped to 0..1', () => {
    const w = createBattle(threeWaves());
    expect(throneHpFraction(w)).toBe(1);
    w.hp[w.throneId] = w.maxHp[w.throneId]! / 4;
    expect(throneHpFraction(w)).toBe(0.25);
    w.hp[w.throneId] = -5;
    expect(throneHpFraction(w)).toBe(0);
  });
});

describe('interventionCooldown', () => {
  it('waits for firstReadyTick, then cooldownTicks after a drop', () => {
    const w = createBattle(threeWaves());
    expect(interventionCooldown(w)).toEqual({ ready: false, fraction: 1, seconds: 3 });
    w.tick = 15;
    expect(interventionCooldown(w)).toEqual({ ready: false, fraction: 0.5, seconds: 2 });
    w.tick = INTERVENTION.firstReadyTick;
    expect(interventionCooldown(w)).toEqual({ ready: true, fraction: 0, seconds: 0 });
    expect(tryIntervene(w, { tick: w.tick, x: 100, y: 100 })).toBe(true);
    expect(interventionCooldown(w)).toEqual({ ready: false, fraction: 1, seconds: 15 });
    w.tick += INTERVENTION.cooldownTicks - 1;
    expect(interventionCooldown(w)).toEqual({ ready: false, fraction: 1 / 150, seconds: 1 });
    w.tick += 1;
    expect(interventionCooldown(w).ready).toBe(true);
  });
});

describe('summaryLines', () => {
  const base = { kills: 12, lives: 2, time: '1:05', goldGain: 0, conquered: null };

  it('lists kills, lives left and the battle time', () => {
    expect(summaryLines(base)).toEqual(['Địch đã hạ: 12', 'Mạng còn: 2', 'Thời gian: 1:05']);
  });

  it('adds the gold earned when there is some', () => {
    expect(summaryLines({ ...base, goldGain: 5 })).toContain('Vàng nhận: +5');
    expect(summaryLines(base).some((l) => l.startsWith('Vàng'))).toBe(false);
  });

  it('announces a conquered king', () => {
    expect(summaryLines({ ...base, conquered: 'Vua Đá Núi' })).toContain('Đã chinh phục Vua Đá Núi!');
  });
});

describe('bossReadout', () => {
  it('is null while there is no boss, before it appears and after it dies', () => {
    expect(bossReadout(createBattle(threeWaves()))).toBeNull();
    const w = bossWorld(1);
    expect(bossReadout(w)).not.toBeNull();
    w.alive[w.bossId] = 0;
    expect(bossReadout(w)).toBeNull();
    const before = createBattle(battleSetup({ boss: realBoss(1) }));
    expect(bossReadout(before)).toBeNull(); // not spawned yet
  });

  it('shows the name, hp and max hp', () => {
    const w = bossWorld(1);
    const r = bossReadout(w)!;
    expect(r.nameVi).toBe('Ông Kẹ Đầm Lầy');
    expect(r.maxHp).toBe(Math.round(w.maxHp[w.bossId]!));
    expect(r.hp).toBe(r.maxHp);
    w.hp[w.bossId] = 100.2;
    expect(bossReadout(w)!.hp).toBe(101);
  });

  it('names the phase of each boss', () => {
    const bog = bossWorld(1);
    expect(bossReadout(bog)!.phase).toBe('Ném Bùn');
    bog.bossFrogsCalled = true;
    expect(bossReadout(bog)!.phase).toBe('Ếch tràn ra');

    const hornet = bossWorld(2);
    expect(bossReadout(hornet)!.phase).toBe('Đàn Ong');
    hornet.bossLanded = true;
    expect(bossReadout(hornet)!.phase).toBe('Hạ Cánh');

    const king = bossWorld(3);
    const set = (pct: number): void => void (king.hp[king.bossId] = (king.maxHp[king.bossId]! * pct) / 100);
    set(100);
    expect(bossReadout(king)!.phase).toBe('Bóng Gương');
    set(50);
    expect(bossReadout(king)!.phase).toBe('Khiên Ngai Vỡ');
    set(20);
    expect(bossReadout(king)!.phase).toBe('Cuồng Vương');
  });
});
