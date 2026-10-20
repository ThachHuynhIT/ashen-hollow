/**
 * Separation (spec §8.11), carried over from the colony sim's movementSystem: bodies that
 * overlap (centre distance < rA + rB) are pushed apart.
 *
 * - Two units: each moves min(overlap / 2, pushMax) away from the other.
 * - Teams (optional `team`): two units of different teams are pushed apart by at most
 *   `crossMax` each (default `pushMax`), and a unit marked `anchored` (in contact with its
 *   target) is never pushed by an enemy, so a crowd cannot shove a fighting unit away.
 * - A structure (`fixed`) never moves; it pushes a non-flying unit fully out of its radius.
 *   Flying units ignore structures. Two structures never push each other.
 * - Exactly coincident centres split along the fixed axis (1, 0), as the old code did.
 *
 * Deterministic: pushes are computed from the positions as given (a snapshot) and only
 * accumulated into `outX`/`outY`, so the caller applies them all at once (§8.9 step 5);
 * pairs are visited in index order; only + − × ÷, Math.sqrt and Math.min are used.
 * Arrays may be typed arrays (BattleWorld struct-of-arrays) or plain arrays.
 */
export interface SeparationBodies {
  readonly count: number;
  readonly x: ArrayLike<number>;
  readonly y: ArrayLike<number>;
  readonly radius: ArrayLike<number>;
  /** 1 = structure (tower, building, throne), 0 = unit. */
  readonly fixed: ArrayLike<number>;
  /** 1 = flying unit, 0 = ground unit. */
  readonly flying: ArrayLike<number>;
  /** Team id per body; without it every pair of units counts as teammates. */
  readonly team?: ArrayLike<number>;
  /** 1 = in contact with its target: ignores pushes from enemy units. */
  readonly anchored?: ArrayLike<number>;
}

/** Below this centre distance two bodies count as coincident. */
const COINCIDENT = 1e-3;

/** Writes each body's separation push into outX/outY (indices 0..count-1, zeroed first). */
export const separationPush = (
  bodies: SeparationBodies,
  pushMax: number,
  outX: Float64Array,
  outY: Float64Array,
  crossMax: number = pushMax,
): void => {
  const { count, x, y, radius, fixed, flying, team, anchored } = bodies;
  outX.fill(0, 0, count);
  outY.fill(0, 0, count);
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const fixedI = fixed[i] === 1;
      const fixedJ = fixed[j] === 1;
      if (fixedI && fixedJ) continue;
      if ((fixedI && flying[j] === 1) || (fixedJ && flying[i] === 1)) continue;
      const minDist = radius[i]! + radius[j]!;
      let dx = x[j]! - x[i]!;
      let dy = y[j]! - y[i]!;
      const distSq = dx * dx + dy * dy;
      if (distSq >= minDist * minDist) continue; // sqrt only for overlapping pairs
      let d = Math.sqrt(distSq);
      if (d < COINCIDENT) {
        dx = 1;
        dy = 0;
        d = 0;
      } else {
        dx /= d;
        dy /= d;
      }
      const overlap = minDist - d;
      if (fixedI) {
        outX[j] = outX[j]! + dx * overlap;
        outY[j] = outY[j]! + dy * overlap;
      } else if (fixedJ) {
        outX[i] = outX[i]! - dx * overlap;
        outY[i] = outY[i]! - dy * overlap;
      } else {
        const enemies = team !== undefined && team[i] !== team[j];
        const push = Math.min(overlap / 2, enemies ? crossMax : pushMax);
        if (!(enemies && anchored !== undefined && anchored[i] === 1)) {
          outX[i] = outX[i]! - dx * push;
          outY[i] = outY[i]! - dy * push;
        }
        if (!(enemies && anchored !== undefined && anchored[j] === 1)) {
          outX[j] = outX[j]! + dx * push;
          outY[j] = outY[j]! + dy * push;
        }
      }
    }
  }
};
