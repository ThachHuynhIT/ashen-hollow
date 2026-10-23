import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../game/cards/registry';
import { createBattle, spawnWave, type BattleWorld } from '../../game/battle/world';
import type { RunState } from '../../game/run/state';
import { battleSetup, structure, unitStats } from '../../game/testing/fixtures';
import { UI_PALETTE } from '../../data/uiPalette';
import { RULES_FULL } from '../../data/rules';
import { bossWorld } from '../../game/battle/bossKit';
import { addDot } from '../../game/battle/statuses';
import { runState, withBuilding } from '../../game/testing/fixtures';
import { buildingInfoModel, unitInfoModel } from './inspectionModel';
import { buildingModelLines, unitModelLines, entityAt, infoContent, placeInfoBox, runSummary, statusLines } from './infoLines';

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

describe('building model lines', () => {
  it('works for every building card and throne in the content', () => {
    for (const card of CONTENT.allCards()) {
      if (card.kind === 'tome' || card.kind === 'enchantment') continue;
      const m = buildingInfoModel(withBuilding(runState(), card.kind === 'throne' ? 12 : 6, card.id, 1), card.kind === 'throne' ? 12 : 6, CONTENT);
      const lines = buildingModelLines(m!);
      expect(lines.length, card.id).toBeGreaterThanOrEqual(3);
      for (const l of lines) expect(l.trim().length, card.id).toBeGreaterThan(0);
    }
  });
});

const entityLines = (w: BattleWorld, id: number): readonly string[] =>
  unitModelLines(unitInfoModel(w, id, runState(), CONTENT)!);

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
    const lines = entityLines(w, id);
    expect(lines[0]).toBe('Thổ Phỉ');
    expect(lines).toContain('Máu: 13 / 30');
    expect(lines.some((l) => l.startsWith('Sát thương: 5 (vật lý)'))).toBe(true);
    expect(lines.some((l) => l.startsWith('Tầm đánh: 2'))).toBe(true);
    expect(lines).toContain('Giáp: 0%');
  });

  it('shows armor as a percentage and the damage type', () => {
    const w = world();
    const lines = entityLines(w, 2); // first spawned militia
    expect(lines[0]).toBe('Dân Quân');
    expect(lines).toContain('Giáp: 25%');
    w.dmgType[2] = 2;
    expect(entityLines(w, 2).some((l) => l.startsWith('Sát thương: 5 (phép)'))).toBe(true);
  });

  it('shows the shield while it lasts and says when a unit is stunned', () => {
    const w = world();
    const id = 2;
    expect(entityLines(w, id).some((l) => l.startsWith('Khiên'))).toBe(false);
    expect(entityLines(w, id)).not.toContain('Đang choáng');
    w.shield[id] = 14.2;
    w.stunTicks[id] = 6;
    const lines = entityLines(w, id);
    expect(lines).toContain('Khiên: 15');
    expect(lines).toContain('Đang choáng');
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

describe('statusLines', () => {
  it('lists burn and poison with their damage per second and time left', () => {
    const w = world();
    const id = 2;
    expect(statusLines(w, id)).toEqual([]);
    addDot(w, id, 'burn', 7, 4, 30, 1); // 4 per second for 30 ticks
    addDot(w, id, 'poison', 8, 2, 50, 3);
    addDot(w, id, 'poison', 8, 2, 50, 3); // second stack
    const lines = statusLines(w, id);
    expect(lines).toContain('Đang bỏng: 4/s (còn 3s)');
    expect(lines).toContain('Nhiễm độc: 4/s (còn 5s)');
    expect(entityLines(w, id)).toEqual(expect.arrayContaining(lines));
  });

  it('says slowed, disabled, enraged and revived', () => {
    const w = world();
    const id = 2;
    w.slowPct[id] = 30;
    w.slowTicks[id] = 25;
    w.disabledUntil[id] = w.tick + 5;
    w.enrageDmgPct[id] = 40;
    w.enrageBelow[id] = 50;
    w.hp[id] = w.maxHp[id]! * 0.4;
    w.revived[id] = 1;
    const lines = statusLines(w, id);
    expect(lines).toContain('Bị làm chậm 30% (còn 3s)');
    expect(lines).toContain('Bị vô hiệu');
    expect(lines).toContain('Nổi giận: +40% sát thương');
    expect(lines).toContain('Đã hồi sinh');
    w.hp[id] = w.maxHp[id]!;
    expect(statusLines(w, id)).not.toContain('Nổi giận: +40% sát thương');
  });

  it('names a boss and shows its landing', () => {
    const w = bossWorld(2);
    expect(entityLines(w, w.bossId)[0]).toBe('Nữ Hoàng Ong Bắp Cày');
    expect(statusLines(w, w.bossId)).not.toContain('Đang hạ cánh: nhận thêm sát thương');
    w.bossLanded = true;
    expect(statusLines(w, w.bossId)).toContain('Đang hạ cánh: nhận thêm sát thương');
  });
});

describe('runSummary', () => {
  const full = (over: Partial<RunState['stats']> = {}): RunState => {
    const s = runState({ rules: RULES_FULL, enemyKings: ['grove', 'tide', 'forge', 'clock', 'moon', 'nomad'] });
    return { ...s, stats: { ...s.stats, completedYears: 12, battlesWon: 10, battlesLost: 2, kills: 345, conquered: 4, goldEarned: 99, ...over } };
  };

  it('shows completed years, conquered kings, bosses and no meta points', () => {
    const lines = runSummary(full({ bossesDefeated: ['boss_bog_ogre'], bossesWon: 1 }));
    expect(lines).toContain('Năm hoàn thành: 12 / 30');
    expect(lines).toContain('Vua đã chinh phục: 4 / 6');
    expect(lines).toContain('Boss đã hạ: 1 / 3');
    expect(lines).toContain('Trận thắng: 10 · Trận thua: 2');
    expect(lines.join(' ')).not.toMatch(/điểm vương miện|mở khoá/i);
  });

  it('gives the golden crown line only when boss 3 was defeated', () => {
    expect(runSummary(full({ bossesDefeated: ['boss_bog_ogre', 'boss_hornet_queen'] })).join('|')).not.toContain('Vương Miện Vàng');
    expect(runSummary(full({ bossesDefeated: ['boss_crownless_king'] })).join('|')).toContain('Vương Miện Vàng');
  });

  it('has no boss line in the short rules', () => {
    expect(runSummary(runState()).join('|')).not.toContain('Boss đã hạ');
  });
});

describe('model lines', () => {
  const unit = {
    title: 'Dân Quân', sourceLevel: null, hp: 10, maxHp: 20, dmg: 5, damageType: 'vật lý', range: 8,
    attacksPerSecond: 0, armorPct: 25, shield: 0, speed: 20, tags: ['cận chiến'], behaviours: [], statuses: ['Đang choáng'],
  } as const;

  it('formats a unit with unknown origin, no attack and statuses', () => {
    const lines = unitModelLines(unit);
    expect(lines).toContain('Không từ công trình của bạn');
    expect(lines).toContain('Không tấn công');
    expect(lines).toContain('Máu: 10 / 20');
    expect(lines).toContain('Đang choáng');
  });

  it('formats a building with stars, age, enchants and the next level', () => {
    const lines = buildingModelLines({
      plot: 6, uid: 1, title: 'Dân Quân', stars: { filled: 3, total: 5, label: 'Cấp 3/5' }, hp: 225, liveHp: null,
      description: ['Sinh lính.'], next: ['Máu: 225 → 262.5'], enchants: ['Mài ×2'], age: { years: 7, bonus: 2 }, spawn: null,
    });
    expect(lines.slice(0, 3)).toEqual(['Dân Quân', 'Cấp 3/5', 'Máu: 225']);
    expect(lines).toContain('Tuổi: 7 năm (thêm 2)');
    expect(lines).toContain('Bùa: Mài ×2');
    expect(lines).toContain('Máu: 225 → 262.5');
  });
});
