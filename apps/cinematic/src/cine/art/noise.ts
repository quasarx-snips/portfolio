/** Deterministic value noise used to paint the project's original smoke art. */

export const hash2 = (x: number, y: number, seed = 0): number => {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return s - Math.floor(s);
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function valueNoise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function fbm(x: number, y: number, seed = 0, octaves = 3): number {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * valueNoise(x * frequency, y * frequency, seed + i * 19.7);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / norm;
}

/** A cheap 0..1 hash for scattering particles and puffs. */
export const h01 = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

export const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

export const smooth01 = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
