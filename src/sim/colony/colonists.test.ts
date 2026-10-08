import { addComponent, hasComponent } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { NEEDS } from '../../data/colonists';
import { COLONIST_NAMES } from '../../data/names';
import { Colonist, Dead, Needs, Position, Sleeping } from '../components';
import { drainEvents } from '../events';
import { createGameWorld } from '../GameWorld';
import { openTerrain } from '../testing/terrainFixture';
import { colonistAt, colonistName, isCarrying, livingColonists } from './colonists';
import { needsSystem } from './needs';

const world = (colonists = 3) =>
  createGameWorld({
    seed: 1,
    colonists,
    map: { terrain: openTerrain(32, 32), doodads: [], start: { x: 256, y: 256 } },
  });

const tickNeeds = (w: ReturnType<typeof world>, n: number) => {
  for (let i = 0; i < n; i++) needsSystem(w);
};

describe('spawning', () => {
  it('spawns the starting colonists near the Hearthfire, fed, rested and empty-handed', () => {
    const w = world();
    const colonists = livingColonists(w);
    expect(colonists).toHaveLength(3);
    const names = colonists.map(colonistName);
    expect(new Set(names).size).toBe(3);
    for (const eid of colonists) {
      expect(COLONIST_NAMES).toContain(colonistName(eid));
      const d = Math.hypot(Position.x[eid]! - 256, Position.y[eid]! - 256);
      expect(d).toBeGreaterThan(8); // not inside the Hearthfire
      expect(d).toBeLessThan(40);
      const { cx, cy } = w.nav.cellOf(Position.x[eid]!, Position.y[eid]!);
      expect(w.nav.walkable(cx, cy)).toBe(true);
      expect([Needs.hunger[eid], Needs.rest[eid], Needs.health[eid]]).toEqual([100, 100, 100]);
      expect(isCarrying(eid)).toBe(false);
    }
  });

  it('colonistAt picks a colonist by their body, not just their feet', () => {
    const w = world(1);
    const [eid] = livingColonists(w);
    const x = Position.x[eid!]!;
    const y = Position.y[eid!]!;
    expect(colonistAt(w, x, y - 12)).toBe(eid); // chest
    expect(colonistAt(w, x + 20, y)).toBeNull();
  });
});

describe('needs', () => {
  it('hunger empties in one day and rest in 1.2 days while awake', () => {
    const w = world(1);
    const [eid] = livingColonists(w);
    tickNeeds(w, 600); // a tenth of a day
    expect(Needs.hunger[eid!]).toBeCloseTo(90, 1);
    expect(Needs.rest[eid!]).toBeCloseTo(100 - 600 * NEEDS.restPerTick, 1);
  });

  it('sleeping in a tent restores rest twice as fast as outdoors', () => {
    const w = world(2);
    const [inTent, outdoors] = livingColonists(w);
    for (const [eid, tent] of [
      [inTent!, 1],
      [outdoors!, 0],
    ] as const) {
      Needs.rest[eid] = 10;
      addComponent(w.ecs, eid, Sleeping);
      Sleeping.inTent[eid] = tent;
    }
    tickNeeds(w, 200);
    expect(Needs.rest[inTent!]).toBeCloseTo(10 + 200 * NEEDS.sleepRestorePerTick, 1); // 20
    expect(Needs.rest[outdoors!]).toBeCloseTo(10 + 100 * NEEDS.sleepRestorePerTick, 1); // 15
  });

  it('starving drains health; at 0 the colonist dies and it is reported', () => {
    const w = world(1);
    const [eid] = livingColonists(w);
    Needs.hunger[eid!] = 0;
    tickNeeds(w, 1000);
    expect(Needs.health[eid!]).toBeCloseTo(50, 0);
    drainEvents(w);
    let ticks = 0;
    while (!hasComponent(w.ecs, eid!, Dead) && ticks < 1100) {
      needsSystem(w);
      ticks++;
    }
    expect(ticks).toBeGreaterThan(990);
    expect(ticks).toBeLessThan(1010);
    expect(livingColonists(w)).toEqual([]);
    expect(drainEvents(w)).toEqual([{ type: 'colonistDied', eid, cause: 'hunger' }]);
  });

  it('health recovers while both needs are comfortable', () => {
    const w = world(1);
    const [eid] = livingColonists(w);
    Needs.health[eid!] = 50;
    tickNeeds(w, 600);
    expect(Needs.health[eid!]).toBeCloseTo(60, 0);
  });

  it('the dead are left alone by the needs system', () => {
    const w = world(1);
    const [eid] = livingColonists(w);
    addComponent(w.ecs, eid!, Dead);
    const before = Needs.hunger[eid!];
    tickNeeds(w, 100);
    expect(Needs.hunger[eid!]).toBe(before);
    expect(hasComponent(w.ecs, eid!, Colonist)).toBe(true); // stays as a grave
  });
});
