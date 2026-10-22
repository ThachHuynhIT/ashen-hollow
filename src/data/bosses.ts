import type { BossId, UnitDef } from './types';

/** Một boss (spec §7.3): thứ tự 1..3 và chỉ số đơn vị của nó. */
export interface BossDef {
  readonly id: BossId;
  readonly ordinal: 1 | 2 | 3;
  readonly unit: UnitDef;
}

/** Mọi con số kỹ năng của ba boss (spec §7.3). */
export const BOSS_RULES = {
  /** Ông Kẹ Đầm Lầy. */
  bog: {
    mudEveryTicks: 80, // Ném Bùn
    mudRange: 160, // px, quanh boss
    mudDmg: 60, // vật lý
    mudDisableTicks: 30, // vô hiệu tháp
    frogBelowHpPct: 50, // Gọi Ếch: lần đầu xuống dưới mức này
    frogCount: 10,
  },
  /** Nữ Hoàng Ong Bắp Cày. */
  hornet: {
    swarmEveryTicks: 50, // Đàn Ong
    swarmCount: 4,
    landEveryTicks: 150, // Hạ Cánh
    landTicks: 40,
    landDmgTakenPct: 25, // nhận thêm sát thương khi đáp
  },
  /** Vua Không Ngai. */
  crownless: {
    mirrorEveryTicks: 100, // Bóng Gương (HP > 66%)
    mirrorAbovePct: 66,
    shieldBelowPct: 66, // Khiên Ngai Vỡ (33–66%)
    shieldAbovePct: 33,
    shield: 3000,
    shieldWindowTicks: 100,
    rageBelowPct: 33, // Cuồng Vương
    rageSpeedPct: 50,
    rageAttackSpeedPct: 50,
    boulderMult: 3, // Can Thiệp gây ×3
  },
} as const;

const boss = (
  id: BossId,
  nameVi: string,
  over: Pick<UnitDef, 'hp' | 'armor' | 'speed' | 'radius' | 'tags' | 'attack'>,
): UnitDef => ({
  id,
  nameVi,
  ...over,
  behaviours: [{ type: 'boss', id }],
  enemyCost: 0, // không bao giờ được `composeArmy` chọn
  sprite: { w: 48, h: 48 },
});

export const BOSSES: readonly BossDef[] = [
  {
    id: 'boss_bog_ogre',
    ordinal: 1,
    unit: boss('boss_bog_ogre', 'Ông Kẹ Đầm Lầy', {
      hp: 2500,
      armor: 0.2,
      speed: 0.5,
      radius: 14,
      tags: ['boss', 'melee', 'siege'],
      attack: { dmg: 40, type: 'physical', range: 4, interval: 20, cleave: 3 },
    }),
  },
  {
    id: 'boss_hornet_queen',
    ordinal: 2,
    unit: boss('boss_hornet_queen', 'Nữ Hoàng Ong Bắp Cày', {
      hp: 9000,
      armor: 0.1,
      speed: 0.8,
      radius: 12,
      tags: ['boss', 'ranged', 'flying'],
      attack: { dmg: 50, type: 'physical', range: 64, interval: 15, projectileSpeed: 9 },
    }),
  },
  {
    id: 'boss_crownless_king',
    ordinal: 3,
    unit: boss('boss_crownless_king', 'Vua Không Ngai', {
      hp: 30000,
      armor: 0.3,
      speed: 0.6,
      radius: 16,
      tags: ['boss', 'melee'],
      attack: { dmg: 120, type: 'physical', range: 6, interval: 18, cleave: 4 },
    }),
  },
];
