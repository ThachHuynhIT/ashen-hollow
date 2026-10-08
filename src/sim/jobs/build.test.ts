import { describe, expect, it } from 'vitest';
import { completeBlueprint, isBlueprint, placeBlueprint } from '../colony/blueprint';
import { isCarrying, livingColonists } from '../colony/colonists';
import { Blueprint, Position } from '../components';
import { removeWorldEntity } from '../GameWorld';
import { inflateShape, shapeContains } from '../geom';
import { runTicks, scenarioWorld } from '../testing/scenario';

const navBlocked = (w: ReturnType<typeof scenarioWorld>, x: number, y: number) => {
  const { cx, cy } = w.nav.cellOf(x, y);
  return !w.nav.walkable(cx, cy);
};

describe('building', () => {
  it('delivers wood from stock and builds a tent', () => {
    const w = scenarioWorld({ stock: { wood: 30 } });
    const tent = placeBlueprint(w, 'tent', 330, 300).eid!;
    expect(runTicks(w, 1500, () => !isBlueprint(w, tent))).toBeLessThan(1500);
    expect(w.stock.get('wood')).toBe(20);
    expect(navBlocked(w, 330, 300)).toBe(true);
  });

  it('waits for materials, then builds once they arrive', () => {
    const w = scenarioWorld({ stock: { wood: 0 } });
    const tent = placeBlueprint(w, 'tent', 330, 300).eid!;
    runTicks(w, 300);
    expect(isBlueprint(w, tent)).toBe(true);
    expect(Blueprint.progress[tent]).toBe(0);
    w.stock.add('wood', 10);
    expect(runTicks(w, 1500, () => !isBlueprint(w, tent))).toBeLessThan(1500);
    expect(w.stock.get('wood')).toBe(0);
  });

  it('brings every kind of material a building needs', () => {
    const w = scenarioWorld({ stock: { wood: 30, stone: 10 } });
    const tower = placeBlueprint(w, 'watchtower', 330, 300).eid!; // 15 wood, 10 stone
    expect(runTicks(w, 2000, () => !isBlueprint(w, tower))).toBeLessThan(2000);
    expect(w.stock.snapshot()).toMatchObject({ wood: 15, stone: 0 });
  });

  it('two deliveries for one stock: one fails cleanly, one tent still gets built', () => {
    const w = scenarioWorld({ colonists: 2, stock: { wood: 10 } });
    const a = placeBlueprint(w, 'tent', 330, 300).eid!;
    const b = placeBlueprint(w, 'tent', 180, 300).eid!;
    runTicks(w, 3000);
    const built = [a, b].filter((t) => !isBlueprint(w, t));
    expect(built).toHaveLength(1);
    const waiting = [a, b].find((t) => isBlueprint(w, t))!;
    expect(Blueprint.pending[0]![waiting]).toBe(0);
    expect(Blueprint.delivered[0]![waiting]).toBe(0);
    expect(w.stock.get('wood')).toBe(0);
  });

  it('a blueprint cancelled mid-delivery returns the goods to stock', () => {
    const w = scenarioWorld({ stock: { wood: 30 } });
    const tent = placeBlueprint(w, 'tent', 330, 300).eid!;
    const [c] = livingColonists(w);
    runTicks(w, 600, () => w.jobs.get(c!)?.kind === 'deliver' && w.jobs.get(c!)!.stage === 2);
    expect(isCarrying(c!)).toBe(true);
    expect(w.stock.get('wood')).toBe(20);
    removeWorldEntity(w, tent);
    expect(runTicks(w, 600, () => w.stock.get('wood') === 30 && !isCarrying(c!))).toBeLessThan(600);
  });

  it('pushes colonists out of the finished footprint', () => {
    const w = scenarioWorld();
    const tent = placeBlueprint(w, 'tent', 330, 300).eid!;
    const [c] = livingColonists(w);
    Position.x[c!] = 330;
    Position.y[c!] = 300;
    completeBlueprint(w, tent);
    const footprint = inflateShape(w.obstacles.get(tent)!.shape, 4);
    expect(shapeContains(footprint, Position.x[c!]!, Position.y[c!]!)).toBe(false);
    expect(navBlocked(w, Position.x[c!]!, Position.y[c!]!)).toBe(false);
  });
});
