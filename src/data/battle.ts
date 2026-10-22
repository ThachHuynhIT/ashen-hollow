/** Hằng số trận (spec §3.6, §7.4, §8.2), chép nguyên văn. */

/** Ngân sách gốc năm 1..30 = round(12 × 1.15^(y−1)), lưu sẵn để không phụ thuộc Math.pow. */
export const ENEMY_BUDGET = [
  12, 14, 16, 18, 21, 24, 28, 32, 37, 42,
  49, 56, 64, 74, 85, 98, 112, 129, 149, 171,
  196, 226, 260, 299, 344, 395, 454, 522, 601, 691,
] as const;

export const SLOT_MULT = {
  raiders: 0.8, // Thổ Phỉ
  coalition: 1.1, // Liên Quân
  kingAttack: [0.9, 1.0, 1.2], // lần 1, 2, 3 của một vua
  boss: [1.5, 1.75, 2.0], // đạo quân đi kèm boss 1, 2, 3 (chưa tính chính boss)
} as const;

/** Tối đa đơn vị địch được tạo từ ngân sách. */
export const ENEMY_CAP = 120;
/** Hệ số EP theo cấp 1..5. */
export const ENEMY_LEVEL_COST = [1, 2, 4, 8, 16] as const;
/** Hệ số HP & DMG theo cấp. */
export const ENEMY_LEVEL_STAT = [1, 1.45, 2.1, 3.05, 4.42] as const;
export const WAVES = { share: [0.4, 0.35, 0.25], spawnTick: [0, 120, 240] } as const;

/** Hằng hình quạt 45° (cos 45° làm tròn xuống nên đúng 45° vẫn nằm trong quạt); không dùng Math.cos. */
export const CONE = { cos45: 0.7071 } as const;

/** Trạng thái theo thời gian (§8.6): bỏng/độc/hồi máu gây hiệu lực mỗi `everyTicks` tick; nhịp đánh không dưới 50% gốc (§5.3). */
export const STATUS = { everyTicks: 10, minIntervalFactor: 0.5 } as const;

export const INTERVENTION = {
  dmgBase: 40,
  dmgPerYear: 10, // sát thương = dmgBase + dmgPerYear × (year − 1), loại phép (bỏ qua giáp)
  radius: 24,
  delayTicks: 6,
  knockback: 12,
  cooldownTicks: 150,
  firstReadyTick: 30,
} as const;

export const BATTLE = {
  field: 384,
  plot: 32,
  boardOrigin: 112,
  structureRadius: 12,
  throneRadius: 14,
  retargetTicks: 5,
  enemyAggro: 48,
  siegeAggro: 96,
  tauntRadiusDefault: 40,
  flyingHitMinRange: 24, // đòn có tầm ≥ 24 (và tháp, pulse, can thiệp) mới đánh được đơn vị bay
  rageTick: 600,
  hardLimitTick: 900,
  rageSpeedPct: 50,
  playerUnitCap: 160,
  bossSummonCap: 40,
  entityCap: 512,
  projectileCap: 400,
  edgeSpan: 0.6,
  spawnSpacing: 10,
  spawnOutside: 12,
  spawnRowGap: 10,
  fieldClampMargin: 32, // đơn vị bị kẹp trong [−32, field + 32]
  separationPushMax: 1,
  /** Trần đẩy giữa hai đơn vị khác phe: địch chen vào chỉ nhích lính ra, không hất văng. */
  separationPushCross: 0.2,
  knockbackTicks: 3,
  maxSlowPct: 60,
  bossStunFactor: 0.5,
  spatialCell: 32,
} as const;

/** 16 vị trí xuất quân quanh tâm ô (px, số nguyên). Lính thứ k dùng SPAWN_OFFSETS[k % 16]; vòng thứ hai trở đi nhân 1.5 rồi làm tròn. */
export const SPAWN_OFFSETS = [
  [0, -8], [8, 0], [0, 8], [-8, 0], [6, -6], [6, 6], [-6, 6], [-6, -6],
  [0, -14], [14, 0], [0, 14], [-14, 0], [10, -10], [10, 10], [-10, 10], [-10, -10],
] as const;
