import { hasComponent, query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { completeBlueprint, placeBlueprint } from '../colony/blueprint';
import { livingColonists } from '../colony/colonists';
import { designate } from '../colony/designation';
import { Needs, Sleeping } from '../components';
import { drainEvents } from '../events';
import { entityAt } from '../GameWorld';
import { runTicks, scenarioWorld } from '../testing/scenario';

const everything = { minX: 0, minY: 0, maxX: 512, maxY: 512 };
const builtTent = (w: ReturnType<typeof scenarioWorld>) => {
  const tent = placeBlueprint(w, 'tent', 300, 300).eid!;
  completeBlueprint(w, tent);
  return tent;
};

describe('eating', () => {
  it('eats stored food when hungry', () => {
    const w = scenarioWorld({ stock: { food: 30 } });
    const [c] = livingColonists(w);
    Needs.hunger[c!] = 10;
    expect(runTicks(w, 300, () => w.stock.get('food') === 29)).toBeLessThan(300);
    expect(Needs.hunger[c!]).toBeGreaterThan(45);
  });

  it('eats a wild glowcap when the stores are empty', () => {
    const w = scenarioWorld({
      stock: { food: 0 },
      doodads: [{ kind: 'glowShroom', x: 320, y: 256 }],
    });
    const shroom = entityAt(w, 320, 256)!;
    const [c] = livingColonists(w);
    Needs.hunger[c!] = 10;
    expect(runTicks(w, 300, () => !w.obstacles.has(shroom))).toBeLessThan(300);
    expect(Needs.hunger[c!]).toBeGreaterThan(30);
  });

  it('starves to death with nothing to eat, and it is reported', () => {
    const w = scenarioWorld({ stock: { food: 0 } });
    const [c] = livingColonists(w);
    Needs.hunger[c!] = 1;
    const ticks = runTicks(w, 2500, () => livingColonists(w).length === 0);
    expect(ticks).toBeGreaterThan(1900);
    expect(ticks).toBeLessThan(2200);
    expect(drainEvents(w)).toContainEqual({ type: 'colonistDied', eid: c, cause: 'hunger' });
  });
});

describe('sleeping', () => {
  it('fills tent beds first, then sleeps by the fire', () => {
    const w = scenarioWorld({ colonists: 3 });
    builtTent(w);
    for (const c of livingColonists(w)) Needs.rest[c] = 10;
    runTicks(w, 150);
    const sleepers = query(w.ecs, [Sleeping]);
    expect(sleepers).toHaveLength(3);
    expect(sleepers.filter((c) => Sleeping.inTent[c] === 1)).toHaveLength(2);
  });

  it('wakes up to eat when hunger becomes urgent and food exists', () => {
    const w = scenarioWorld({ stock: { food: 5 } });
    builtTent(w);
    const [c] = livingColonists(w);
    Needs.rest[c!] = 10;
    runTicks(w, 150, () => hasComponent(w.ecs, c!, Sleeping));
    Needs.hunger[c!] = 10;
    runTicks(w, 1);
    expect(w.jobs.get(c!)?.kind).toBe('eat');
    expect(hasComponent(w.ecs, c!, Sleeping)).toBe(false);
    expect(runTicks(w, 300, () => w.stock.get('food') === 4)).toBeLessThan(300);
  });

  it("doesn't thrash between sleep and food when there is nothing to eat", () => {
    const w = scenarioWorld({ stock: { food: 0 } });
    const [c] = livingColonists(w);
    Needs.rest[c!] = 10;
    Needs.hunger[c!] = 10;
    runTicks(w, 150, () => hasComponent(w.ecs, c!, Sleeping));
    runTicks(w, 100, () => {
      expect(hasComponent(w.ecs, c!, Sleeping)).toBe(true);
      return false;
    });
  });
});

describe('urgent needs interrupt work', () => {
  const choppingWorld = () => {
    const w = scenarioWorld({
      stock: { food: 5 },
      doodads: [
        { kind: 'deadTree', x: 330, y: 256 },
        { kind: 'deadTree', x: 345, y: 256 },
      ],
    });
    designate(w, everything, 'chop');
    const [c] = livingColonists(w);
    runTicks(w, 600, () => w.jobs.get(c!)?.kind === 'harvest' && w.jobs.get(c!)!.stage === 1);
    return { w, c: c! };
  };

  it('urgent hunger', () => {
    const { w, c } = choppingWorld();
    Needs.hunger[c] = 10;
    runTicks(w, 1);
    expect(w.jobs.get(c)?.kind).toBe('eat');
  });

  it('urgent rest', () => {
    const { w, c } = choppingWorld();
    Needs.rest[c] = 10;
    runTicks(w, 1);
    expect(w.jobs.get(c)?.kind).toBe('sleep');
  });
});
