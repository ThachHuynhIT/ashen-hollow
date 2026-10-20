/** Thẻ và đơn vị trung lập của G1 (spec §6.1). */
import type { CardDef, UnitDef } from './types';

export const NEUTRAL_UNITS: readonly UnitDef[] = [
  {
    id: 'footman',
    nameVi: 'Lính Bộ',
    hp: 45,
    attack: { dmg: 7, type: 'physical', range: 2, interval: 10 },
    speed: 0.9,
    radius: 4,
    armor: 0.1,
    tags: ['melee', 'human'],
    enemyCost: 1.5,
    sprite: { w: 16, h: 16 },
  },
];

export const NEUTRAL_CARDS: readonly CardDef[] = [
  {
    id: 'neutral_barracks',
    owner: 'neutral',
    nameVi: 'Trại Lính',
    name: 'Barracks',
    kind: 'troop',
    rarity: 'common',
    tags: [],
    textVi: 'Sinh {count} Lính Bộ khi ra trận.',
    effects: [{ type: 'spawn', unit: 'footman', count: [3, 4, 5, 6, 7] }],
  },
  {
    id: 'neutral_archer_tower',
    owner: 'neutral',
    nameVi: 'Tháp Cung',
    name: 'Archer Tower',
    kind: 'tower',
    rarity: 'common',
    tags: [],
    textVi: 'Bắn {dmg} sát thương, tầm {range}.',
    effects: [
      {
        type: 'tower',
        attack: { dmg: 7, type: 'physical', range: 88, interval: 12, projectileSpeed: 8 },
        targeting: 'closestToThrone',
      },
    ],
  },
  {
    id: 'neutral_clear_land',
    owner: 'neutral',
    nameVi: 'Khai Hoang',
    name: 'Clear Land',
    kind: 'tome',
    rarity: 'common',
    tags: [],
    textVi: 'Mở một ô khoá bất kỳ.',
    target: 'lockedPlot',
    actions: [{ type: 'unlockPlot', gold: 0 }],
  },
  {
    id: 'neutral_move',
    owner: 'neutral',
    nameVi: 'Dời Nhà',
    name: 'Relocate',
    kind: 'tome',
    rarity: 'common',
    tags: [],
    textVi: 'Dời một công trình sang ô đã mở khác (đổi chỗ nếu có).',
    target: 'buildingThenPlot',
    actions: [{ type: 'move', levelIfFar: 0 }],
  },
];
