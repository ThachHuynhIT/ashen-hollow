import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../game/cards/registry';
import { describeCard } from '../../game/cards/describe';
import { createBattle, spawnWave, type BattleWorld } from '../../game/battle/world';
import type { BuildingState } from '../../game/run/state';
import { battleSetup, structure, unitStats } from '../../game/testing/fixtures';
import { UI_PALETTE } from '../../data/uiPalette';
import { buildingInfoLines, entityAt, entityInfoLines, infoContent, placeInfoBox } from './infoLines';

const building = (cardId: BuildingState['cardId'], level: BuildingState['level'] = 1): BuildingState => ({
  uid: 1,
  cardId,
  level,
  enchants: [], placedYear: 1, permanent: {}, ageBonus: 0, counters: {}, movedYear: null
});

describe('infoContent', () => {
  it('titles the first line and tints level, HP and spawned-unit lines from UI_PALETTE', () => {
    const c = infoContent(['Dân Quân', 'Cấp 2', 'Máu: 100', 'Lính: Dân Quân ×6', 'Máu lính 32 · Giáp 25%', 'Sinh lính.']);
    expect(c.title).toBe('Dân Quân');
    const colorOf = (i: number) => c.lines[i]![0]!.color;
    expect(colorOf(0)).toBe(UI_PALETTE.wood);
    expect(colorOf(1)).toBe(UI_PALETTE.good);
    expect(colorOf(2)).toBe(UI_PALETTE.woodDark);
    expect(colorOf(3)).toBe(UI_PALETTE.woodDark);
    expect(colorOf(4)).toBeUndefined();
  });
});

describe('buildingInfoLines', () => {
  it('shows name, level, structure HP and the describeCard line', () => {
    const lines = buildingInfoLines(building('wheat_militia', 3), CONTENT);
    expect(lines[0]).toBe('Dân Quân');
    expect(lines).toContain('Cấp 3');
    expect(lines).toContain('Máu: 150');
    expect(lines).toContain(describeCard(CONTENT.card('wheat_militia'), 3).lines[0]);
  });

  it('lists the units a troop building spawns, with count at its level and their stats', () => {
    const unit = CONTENT.unit('militia');
    const lines = buildingInfoLines(building('wheat_militia', 3), CONTENT);
    expect(lines).toContain(`Lính: ${unit.nameVi} ×${8}`);
    const stats = lines.find((l) => l.startsWith('Máu lính'))!;
    expect(stats).toContain(`Máu lính ${unit.hp}`);
    expect(stats).toContain(`Sát thương ${unit.attack.dmg}`);
    expect(stats).toContain(`Giáp ${Math.round(unit.armor * 100)}%`);
  });

  it('shows no unit section for a building that spawns nothing', () => {
    const lines = buildingInfoLines(building('wheat_throne'), CONTENT);
    expect(lines.some((l) => l.startsWith('Lính:'))).toBe(false);
  });

  it('lists each enchantment with its stack count', () => {
    const b = { ...building('wheat_militia', 2), enchants: [
      { cardId: 'neutral_sharpen' as const, stacks: 2 },
      { cardId: 'neutral_fortify' as const, stacks: 1 },
    ] };
    const lines = buildingInfoLines(b, CONTENT);
    expect(lines).toContain(`Bùa: ${CONTENT.card('neutral_sharpen').nameVi} ×2`);
    expect(lines).toContain(`Bùa: ${CONTENT.card('neutral_fortify').nameVi} ×1`);
    expect(buildingInfoLines(building('wheat_militia'), CONTENT).some((l) => l.startsWith('Bùa:'))).toBe(false);
  });

  it('uses the throne HP for the throne', () => {
    const lines = buildingInfoLines(building('wheat_throne'), CONTENT);
    expect(lines).toContain('Máu: 300');
    expect(lines[0]).toBe(CONTENT.card('wheat_throne').nameVi);
  });

  it('works for every building card and throne in the content', () => {
    for (const card of CONTENT.allCards()) {
      if (card.kind === 'tome') continue;
      const lines = buildingInfoLines(building(card.id), CONTENT);
      expect(lines.length).toBeGreaterThanOrEqual(3);
      for (const l of lines) expect(l.trim().length).toBeGreaterThan(0);
    }
  });
});

const militia = unitStats({ unit: 'militia', hp: 32, dmg: 5, range: 2, armor: 0.25, radius: 4 });
const bandit = unitStats({ unit: 'bandit', hp: 30, dmg: 5, radius: 4, speed: 0 });

/** Ally troop building on plot 6 (spawns 2 militia) and a foe wave of 2 bandits. */
const world = (): BattleWorld => {
  const w = createBattle(
    battleSetup({
      structures: [structure(6, { cardId: 'wheat_militia', spawn: { stats: militia, count: 2 } })],
      waves: [{ spawnTick: 0, spawns: [bandit, bandit].map((stats) => ({ stats, edge: 'N' as const })) }],
    }),
  );
  spawnWave(w, 0);
  return w;
};

describe('entityAt', () => {
  it('finds the structure under a point and ignores empty ground', () => {
    const w = world();
    const id = entityAt(w, w.x[1]!, w.y[1]!);
    expect(id).toBe(1);
    expect(entityAt(w, 5, 380)).toBeNull();
  });

  it('allows a few px of slop around an entity', () => {
    const w = world();
    // left of the structure: the two militia stand above and to the right of it
    expect(entityAt(w, w.x[1]! - w.radius[1]! - 3, w.y[1]!)).toBe(1);
    expect(entityAt(w, w.x[1]! - w.radius[1]! - 20, w.y[1]!)).toBeNull();
  });

  it('picks the nearest entity, then the lowest id, and skips dead ones', () => {
    const w = world();
    const a = w.count - 2;
    const b = w.count - 1;
    w.x[a] = 100;
    w.y[a] = 100;
    w.x[b] = 100;
    w.y[b] = 100;
    expect(entityAt(w, 100, 100)).toBe(a); // tie → lowest id
    w.x[b] = 102;
    expect(entityAt(w, 103, 100)).toBe(b); // nearer centre wins
    w.alive[b] = 0;
    expect(entityAt(w, 103, 100)).toBe(a);
  });
});

describe('entityInfoLines', () => {
  it('describes a unit: name, HP, damage, range, armor', () => {
    const w = world();
    const id = w.count - 1; // a foe bandit
    w.hp[id] = 12.2;
    const lines = entityInfoLines(w, id, CONTENT);
    expect(lines[0]).toBe('Thổ Phỉ');
    expect(lines).toContain('Máu: 13 / 30');
    expect(lines).toContain('Sát thương: 5 (vật lý)');
    expect(lines).toContain('Tầm đánh: 2');
    expect(lines).toContain('Giáp: 0%');
  });

  it('shows armor as a percentage and the damage type', () => {
    const w = world();
    const lines = entityInfoLines(w, 2, CONTENT); // first spawned militia
    expect(lines[0]).toBe('Dân Quân');
    expect(lines).toContain('Giáp: 25%');
    w.dmgType[2] = 2;
    expect(entityInfoLines(w, 2, CONTENT)).toContain('Sát thương: 5 (phép)');
  });

  it('shows the shield while it lasts and says when a unit is stunned', () => {
    const w = world();
    const id = 2;
    expect(entityInfoLines(w, id, CONTENT).some((l) => l.startsWith('Khiên'))).toBe(false);
    expect(entityInfoLines(w, id, CONTENT)).not.toContain('Đang choáng');
    w.shield[id] = 14.2;
    w.stunTicks[id] = 6;
    const lines = entityInfoLines(w, id, CONTENT);
    expect(lines).toContain('Khiên: 15');
    expect(lines).toContain('Đang choáng');
  });

  it('says a building that cannot attack does not attack', () => {
    const w = world();
    const lines = entityInfoLines(w, 1, CONTENT);
    expect(lines[0]).toBe('Dân Quân');
    expect(lines).toContain('Không tấn công');
    expect(lines.some((l) => l.startsWith('Sát thương'))).toBe(false);
  });
});

describe('placeInfoBox', () => {
  const screen = { w: 400, h: 300 };
  const size = { w: 120, h: 80 };

  it('opens to the lower right of the anchor when there is room', () => {
    const p = placeInfoBox({ x: 50, y: 50 }, size, screen);
    expect(p.x).toBeGreaterThan(50);
    expect(p.y).toBeGreaterThan(50);
  });

  it('flips left and up near the right and bottom edges and stays on screen', () => {
    for (const anchor of [{ x: 395, y: 295 }, { x: 0, y: 0 }, { x: 200, y: 299 }]) {
      const p = placeInfoBox(anchor, size, screen);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + size.w).toBeLessThanOrEqual(screen.w);
      expect(p.y + size.h).toBeLessThanOrEqual(screen.h);
    }
  });
});
