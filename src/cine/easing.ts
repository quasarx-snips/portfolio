export const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

/** Normalised position of `p` inside [a, b], clamped to 0..1. */
export const range = (p: number, a: number, b: number): number => clamp01((p - a) / (b - a));

export const smooth = (t: number): number => t * t * (3 - 2 * t);

export const smoothstep = (p: number, a: number, b: number): number => smooth(range(p, a, b));

export const easeInCubic = (t: number): number => t * t * t;

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutSine = (t: number): number => Math.sin((t * Math.PI) / 2);

export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

export const envelope = (p: number, a: number, b: number, c: number, d: number): number =>
  smoothstep(p, a, b) * (1 - smoothstep(p, c, d));
