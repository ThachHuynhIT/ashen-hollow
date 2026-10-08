/**
 * Seeded 2D value noise with fractal octaves. Small and dependency-free; good enough
 * for terrain blobs. Swap for simplex later if the maps look too grid-aligned.
 */
const hash2 = (seed: number, x: number, y: number): number => {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Value noise in [0, 1). */
export const valueNoise2D = (seed: number, x: number, y: number): number => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const a = hash2(seed, x0, y0);
  const b = hash2(seed, x0 + 1, y0);
  const c = hash2(seed, x0, y0 + 1);
  const d = hash2(seed, x0 + 1, y0 + 1);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
};

export interface FractalOptions {
  octaves: number;
  /** Base frequency (features per unit). */
  frequency: number;
  /** Amplitude multiplier per octave. */
  persistence: number;
}

/** Fractal (fBm) value noise normalised to [0, 1). */
export const fractalNoise2D = (
  seed: number,
  x: number,
  y: number,
  { octaves, frequency, persistence }: FractalOptions,
): number => {
  let amplitude = 1;
  let freq = frequency;
  let total = 0;
  let max = 0;
  for (let o = 0; o < octaves; o++) {
    total += valueNoise2D(seed + o * 1013, x * freq, y * freq) * amplitude;
    max += amplitude;
    amplitude *= persistence;
    freq *= 2;
  }
  return total / max;
};
