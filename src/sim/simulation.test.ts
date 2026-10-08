import { describe, expect, it } from 'vitest';
import { placeBlueprint } from './colony/blueprint';
import { livingColonists } from './colony/colonists';
import { designate } from './colony/designation';
import { Needs, Position } from './components';
import { createGameWorld, type GameWorld } from './GameWorld';
import { runTicks } from './testing/scenario';

const around = (w: GameWorld, r: number) => ({
  minX: w.start.x - r,
  minY: w.start.y - r,
  maxX: w.start.x + r,
  maxY: w.start.y + r,
});

/** Copy out everything that matters (component arrays are shared between worlds). */
const snapshot = (w: GameWorld) => ({
  tick: w.tick,
  stock: w.stock.snapshot(),
  obstacles: w.obstacles.size,
  colonists: livingColonists(w).map((c) => [
    c,
    Position.x[c],
    Position.y[c],
    Needs.hunger[c],
    Needs.rest[c],
    w.jobs.get(c)?.kind ?? null,
  ]),
});

const play = () => {
  const w = createGameWorld({ seed: 7 });
  designate(w, around(w, 200), 'chop');
  placeBlueprint(w, 'tent', w.start.x + 40, w.start.y + 30);
  runTicks(w, 2000);
  return snapshot(w);
};

describe('simulation', () => {
  it('is deterministic: same seed and same orders give the same world', () => {
    const a = play();
    const b = play();
    expect(b).toEqual(a);
    expect(a.stock.wood).toBeGreaterThan(30); // and work actually happened
  });

  it('benchmark: 50 colonists for 1000 ticks', () => {
    const w = createGameWorld({ seed: 7, colonists: 50 });
    designate(w, around(w, 400), 'chop');
    const t0 = performance.now();
    runTicks(w, 1000);
    const perTick = (performance.now() - t0) / 1000;
    console.info(`[bench] ${perTick.toFixed(2)} ms/tick with 50 colonists`);
    // Spec §9: above 4 ms/tick → move path-finding into a Web Worker in Phase 3.
    // This assertion only guards against pathological regressions.
    expect(perTick).toBeLessThan(20);
  }, 60_000);
});
