/** Giảm sát thương theo giáp (spec §8.5): vật lý `raw × (1 − giáp)`, lửa `raw × (1 − giáp/2)`, phép `raw`. */
import type { DamageType } from '../../data/types';

export const mitigate = (raw: number, type: DamageType, armor: number): number => {
  if (type === 'magic') return raw;
  if (type === 'fire') return raw * (1 - armor / 2);
  return raw * (1 - armor);
};
