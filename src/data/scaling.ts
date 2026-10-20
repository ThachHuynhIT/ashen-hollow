import type { Level, PerLevel } from './types';

/** Hồ sơ tăng cấp chuẩn L1→L5 (spec §5.2). */
export const TROOP_STD: PerLevel = [1, 1.25, 1.5, 1.75, 2]; // HP và DMG lính do công trình sinh ra
export const TOWER_STD: PerLevel = [1, 1.35, 1.7, 2.05, 2.4]; // DMG tháp / đòn pulse
export const STRUCT_STD: PerLevel = [1, 1.25, 1.5, 1.75, 2]; // máu công trình
export const THRONE_STD: PerLevel = [1, 1.25, 1.5, 1.75, 2]; // HP và DMG của Ngai
/** Cộng vào tầm tháp / bán kính pulse (px) theo cấp. */
export const TOWER_RANGE: PerLevel = [0, 4, 8, 12, 16];

/** Giá trị của hồ sơ ở cấp `level`. */
export const levelMult = (profile: PerLevel, level: Level): number => profile[level - 1]!;

/** HP công trình mặc định theo loại (cấp 1). */
export const STRUCT_HP = { troop: 150, tower: 220, economy: 120, support: 160 } as const;

export const MAX_UNITS_PER_BUILDING = 20;
