import { describe, expect, it } from 'vitest';
import { terrainIndex } from '../../data/terrain';
import { isCarrying, livingColonists } from '../colony/colonists';
import { designate, undesignate } from '../colony/designation';
import { Needs, Position } from '../components';
import { entityAt } from '../GameWorld';
import { runTicks, scenarioWorld } from '../testing/scenario';
import { openTerrain } from '../testing/terrainFixture';

const everything = { minX: 0, minY: 0, maxX: 512, maxY: 512 };

describe('harvesting', () => {
  it('chops a designated tree and hauls the wood home', () => {
    const w = scenarioWorld({ doodads: [{ kind: 'deadTree', x: 330, y: 256 }] });
    designate(w, everything, 'chop');
    const tree = entityAt(w, 330, 256)!;
    const [c] = livingColonists(w);
    const ticks = runTicks(w, 600, () => w.stock.get('wood') === 50 && !isCarrying(c!));
    expect(ticks).toBeLessThan(600);
    expect(w.obstacles.has(tree)).toBe(false);
    expect(w.reservations.isFree(tree)).toBe(true);
  });

  it('mines a designated boulder for stone', () => {
    const w = scenarioWorld({ doodads: [{ kind: 'boulder', x: 200, y: 256 }] });
    designate(w, everything, 'mine');
    expect(runTicks(w, 600, () => w.stock.get('stone') === 40)).toBeLessThan(600);
  });

  it('never lets two colonists work the same tree', () => {
    const w = scenarioWorld({ colonists: 2, doodads: [{ kind: 'deadTree', x: 330, y: 256 }] });
    designate(w, everything, 'chop');
    const tree = entityAt(w, 330, 256)!;
    let maxWorkers = 0;
    runTicks(w, 600, () => {
      const workers = [...w.jobs.values()].filter((j) => j.kind === 'harvest' && j.target === tree);
      maxWorkers = Math.max(maxWorkers, workers.length);
      return w.stock.get('wood') === 50;
    });
    expect(maxWorkers).toBe(1);
    runTicks(w, 100);
    expect(w.stock.get('wood')).toBe(50);
  });

  it('stops and releases the tree when it is undesignated mid-chop', () => {
    const w = scenarioWorld({ doodads: [{ kind: 'deadTree', x: 330, y: 256 }] });
    designate(w, everything, 'chop');
    const tree = entityAt(w, 330, 256)!;
    const [c] = livingColonists(w);
    runTicks(w, 600, () => w.jobs.get(c!)?.kind === 'harvest' && w.jobs.get(c!)!.stage === 1);
    undesignate(w, everything);
    runTicks(w, 1);
    const job = w.jobs.get(c!);
    expect(job?.kind === 'harvest' && job.target === tree).toBe(false);
    expect(w.reservations.isFree(tree)).toBe(true);
    runTicks(w, 200);
    expect(w.obstacles.has(tree)).toBe(true);
    expect(w.stock.get('wood')).toBe(30);
  });

  it('gives up on unreachable targets instead of retrying forever', () => {
    // A tree at the centre of a 7×7-cell block of crag (its own cell is grass),
    // well away from where the colonist spawns (east of the Hearthfire).
    const terrain = openTerrain(32, 32);
    for (let y = 5; y <= 11; y++) {
      for (let x = 5; x <= 11; x++) {
        if (x !== 8 || y !== 8) terrain.set(x, y, terrainIndex('cliff'));
      }
    }
    const w = scenarioWorld({ terrain, doodads: [{ kind: 'deadTree', x: 136, y: 136 }] });
    designate(w, everything, 'chop');
    const tree = entityAt(w, 136, 136)!;
    const [c] = livingColonists(w);
    runTicks(w, 100);
    expect(w.unreachable.get(tree)).toBeGreaterThan(w.tick);
    expect(w.jobs.get(c!)?.target === tree).toBe(false);
    expect(w.obstacles.has(tree)).toBe(true);
  });
});

describe('idling and dying', () => {
  it('idle colonists wander near the Hearthfire on walkable ground', () => {
    const w = scenarioWorld({ colonists: 3 });
    runTicks(w, 400, () => {
      for (const c of livingColonists(w)) {
        const { cx, cy } = w.nav.cellOf(Position.x[c]!, Position.y[c]!);
        expect(w.nav.walkable(cx, cy)).toBe(true);
        expect(Math.hypot(Position.x[c]! - 256, Position.y[c]! - 256)).toBeLessThan(64);
      }
      return false;
    });
  });

  it('a colonist who dies mid-job releases what they had reserved', () => {
    const w = scenarioWorld({ doodads: [{ kind: 'deadTree', x: 330, y: 256 }] });
    designate(w, everything, 'chop');
    const tree = entityAt(w, 330, 256)!;
    const [c] = livingColonists(w);
    runTicks(w, 600, () => w.jobs.get(c!)?.kind === 'harvest');
    Needs.hunger[c!] = 0;
    Needs.health[c!] = 0.01;
    runTicks(w, 1);
    expect(livingColonists(w)).toEqual([]);
    expect(w.jobs.has(c!)).toBe(false);
    expect(w.reservations.isFree(tree)).toBe(true);
    expect(w.paths.has(c!)).toBe(false);
  });
});
