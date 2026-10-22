/** Thổ Phỉ — quân trung lập chỉ làm địch (spec §6.2). */
import type { UnitDef, UnitId } from './types';

export const RAIDER_UNITS: readonly UnitDef[] = [
  {
    id: 'bandit',
    nameVi: 'Thổ Phỉ',
    hp: 30,
    attack: { dmg: 5, type: 'physical', range: 2, interval: 10 },
    speed: 0.9,
    radius: 4,
    armor: 0,
    tags: ['melee', 'human'],
    enemyCost: 1,
    sprite: { w: 16, h: 16 },
  },
  {
    id: 'bandit_archer',
    nameVi: 'Cung Thủ Phỉ',
    hp: 22,
    attack: { dmg: 5, type: 'physical', range: 56, interval: 14, projectileSpeed: 7 },
    speed: 0.8,
    radius: 4,
    armor: 0,
    tags: ['ranged', 'human'],
    enemyCost: 1.2,
    sprite: { w: 16, h: 16 },
  },
  {
    id: 'boar_rider',
    nameVi: 'Kỵ Lợn Rừng',
    hp: 50,
    attack: { dmg: 8, type: 'physical', range: 2, interval: 12 },
    speed: 1.5,
    radius: 5,
    armor: 0.1,
    tags: ['melee', 'cavalry'],
    enemyCost: 2,
    sprite: { w: 24, h: 24 },
  },
  {
    id: 'ogre',
    nameVi: 'Gã Hộ Pháp',
    hp: 180,
    attack: { dmg: 16, type: 'physical', range: 4, interval: 18 },
    speed: 0.6,
    radius: 9,
    armor: 0.2,
    tags: ['melee', 'siege'],
    enemyCost: 5,
    sprite: { w: 24, h: 32 },
  },
];

/** Đơn vị boss triệu hồi (spec §6.2): EP 0, không nằm trong roster nên `composeArmy` không bao giờ chọn. */
export const BOSS_SUMMON_UNITS: readonly UnitDef[] = [
  {
    id: 'frog',
    nameVi: 'Ếch Đầm',
    hp: 20,
    attack: { dmg: 4, type: 'physical', range: 2, interval: 10 },
    speed: 1.2,
    radius: 3,
    armor: 0,
    tags: ['melee', 'summon'],
    enemyCost: 0,
    sprite: { w: 16, h: 16 },
  },
  {
    id: 'hornet',
    nameVi: 'Ong Bắp Cày',
    hp: 25,
    attack: { dmg: 6, type: 'physical', range: 2, interval: 8 },
    speed: 1.6,
    radius: 3,
    armor: 0,
    tags: ['melee', 'flying', 'summon'],
    enemyCost: 0,
    sprite: { w: 16, h: 16 },
  },
];

export const RAIDER_ROSTER: readonly { readonly unit: UnitId; readonly weight: number }[] = [
  { unit: 'bandit', weight: 50 },
  { unit: 'bandit_archer', weight: 25 },
  { unit: 'boar_rider', weight: 15 },
  { unit: 'ogre', weight: 10 },
];
