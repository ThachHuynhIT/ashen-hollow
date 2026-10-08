import { describe, expect, it } from 'vitest';
import {
  completeBlueprint,
  deliverToBlueprint,
  placeBlueprint,
  reservePending,
} from '../colony/blueprint';
import { livingColonists, setCarry } from '../colony/colonists';
import { designate } from '../colony/designation';
import { Needs } from '../components';
import { entityAt } from '../GameWorld';
import { scenarioWorld } from '../testing/scenario';
import { chooseJob } from './chooseJob';
import { newJob } from './types';

const everything = { minX: 0, minY: 0, maxX: 512, maxY: 512 };
const first = (w: ReturnType<typeof scenarioWorld>) => livingColonists(w)[0]!;

describe('chooseJob', () => {
  it('idles when there is nothing to do', () => {
    const w = scenarioWorld();
    expect(chooseJob(w, first(w)).kind).toBe('idle');
  });

  it('hauls first when carrying something', () => {
    const w = scenarioWorld({ doodads: [{ kind: 'deadTree', x: 300, y: 256 }] });
    designate(w, everything, 'chop');
    setCarry(first(w), 'wood', 20);
    expect(chooseJob(w, first(w))).toMatchObject({ kind: 'haulToDrop', target: w.hearthfire });
  });

  it('harvests designated doodads, skipping reserved and unreachable ones', () => {
    const w = scenarioWorld({ doodads: [{ kind: 'deadTree', x: 300, y: 256 }] });
    designate(w, everything, 'chop');
    const tree = entityAt(w, 300, 256)!;
    expect(chooseJob(w, first(w))).toMatchObject({ kind: 'harvest', target: tree });
    w.reservations.reserve(tree, 9999);
    expect(chooseJob(w, first(w)).kind).toBe('idle');
    w.reservations.releaseColonist(9999);
    w.unreachable.set(tree, w.tick + 600);
    expect(chooseJob(w, first(w)).kind).toBe('idle');
  });

  it('building a supplied blueprint beats a closer tree', () => {
    const w = scenarioWorld({ doodads: [{ kind: 'deadTree', x: 270, y: 256 }] });
    designate(w, everything, 'chop');
    const bp = placeBlueprint(w, 'tent', 400, 300).eid!;
    reservePending(bp, 'wood', 10);
    deliverToBlueprint(w, bp, 'wood', 10);
    expect(chooseJob(w, first(w))).toMatchObject({ kind: 'construct', target: bp });
  });

  it('delivers what a blueprint lacks, as much as stock and hands allow', () => {
    const w = scenarioWorld({ stock: { wood: 7 } });
    const bp = placeBlueprint(w, 'storage', 300, 300).eid!; // needs 20 wood
    expect(chooseJob(w, first(w))).toMatchObject({
      kind: 'deliver',
      target: bp,
      source: w.hearthfire,
      resource: 'wood',
      amount: 7,
    });
  });

  it('does not deliver from an empty stock', () => {
    const w = scenarioWorld({ stock: { wood: 0 } });
    placeBlueprint(w, 'tent', 300, 300);
    expect(chooseJob(w, first(w)).kind).toBe('idle');
  });

  it('urgent hunger: stored food first, then wild glowcaps, otherwise carry on', () => {
    const w = scenarioWorld({
      doodads: [{ kind: 'glowShroom', x: 320, y: 256 }],
      stock: { food: 1 },
    });
    const eid = first(w);
    Needs.hunger[eid] = 10;
    expect(chooseJob(w, eid)).toMatchObject({ kind: 'eat', target: w.hearthfire, wild: false });
    w.stock.take('food', 1);
    expect(chooseJob(w, eid)).toMatchObject({
      kind: 'eat',
      target: entityAt(w, 320, 256),
      wild: true,
    });

    const starving = scenarioWorld({ stock: { food: 0 } });
    Needs.hunger[first(starving)] = 10;
    expect(chooseJob(starving, first(starving)).kind).toBe('idle');
  });

  it('urgent rest: a tent with a free bed, otherwise the ground by the fire', () => {
    const w = scenarioWorld({ colonists: 3 });
    const tent = placeBlueprint(w, 'tent', 300, 300).eid!;
    completeBlueprint(w, tent);
    const [a, b, c] = livingColonists(w);
    Needs.rest[a!] = 10;
    expect(chooseJob(w, a!)).toMatchObject({ kind: 'sleep', target: tent });
    w.jobs.set(b!, newJob('sleep', tent));
    w.jobs.set(c!, newJob('sleep', tent));
    expect(chooseJob(w, a!)).toMatchObject({ kind: 'sleep', target: w.hearthfire });
  });

  it('when both needs are urgent, eating comes first', () => {
    const w = scenarioWorld({ stock: { food: 5 } });
    const eid = first(w);
    Needs.hunger[eid] = 12;
    Needs.rest[eid] = 5;
    expect(chooseJob(w, eid).kind).toBe('eat');
  });

  it('low (not urgent) needs only win when there is no work', () => {
    const w = scenarioWorld({
      doodads: [{ kind: 'deadTree', x: 300, y: 256 }],
      stock: { food: 5 },
    });
    const eid = first(w);
    Needs.hunger[eid] = 25;
    designate(w, everything, 'chop');
    expect(chooseJob(w, eid).kind).toBe('harvest');
    const idle = scenarioWorld({ stock: { food: 5 } });
    Needs.hunger[first(idle)] = 25;
    expect(chooseJob(idle, first(idle)).kind).toBe('eat');
  });
});
