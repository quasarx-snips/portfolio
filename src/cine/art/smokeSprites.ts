import { clamp01, fbm, h01, smooth01 } from './noise';

/**
 * Original smoke art, painted procedurally at load time.
 *
 * Each sprite is a soft, turbulent density field with baked-in shadow and
 * highlight, so the runtime only has to translate, rotate, scale and composite
 * a handful of textures. Nothing is downloaded and nothing is a photograph.
 */

const TINTS: ReadonlyArray<readonly [number, number, number]> = [
  [116, 112, 108],
  [166, 161, 154],
  [205, 198, 188],
  [246, 239, 227],
];

interface SpriteSet {
  shapes: HTMLCanvasElement[][];
  size: number;
}

let desktopSet: SpriteSet | null = null;
let mobileSet: SpriteSet | null = null;

function paintShape(size: number, shape: number, tints: ReadonlyArray<readonly [number, number, number]>) {
  const seed = shape * 17.3 + 4.1;
  const wide = shape % 3 === 2;
  const density = new Float32Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / size) * 2 - 1;
      const ny = (y / size) * 2 - 1;

      // Elliptical envelope keeps the sprite's edge invisible.
      const radius = Math.sqrt(nx * nx * (wide ? 0.55 : 1) + ny * ny * (wide ? 1.55 : 1));
      const falloff = Math.pow(clamp01(1 - radius), 1.45);
      if (falloff <= 0) continue;

      const body = fbm(nx * 2.15 + seed, ny * 2.15 - seed * 0.7, seed, 3);
      const detail = fbm(nx * (wide ? 1.4 : 4.6) + 19, ny * (wide ? 5.8 : 4.6) - 7, seed + 9, 2);
      const voids = fbm(nx * 1.35 + 61, ny * 1.35 + 33, seed + 23, 2);

      let value = falloff * (0.28 + 0.95 * body) * (0.72 + 0.6 * detail);
      value *= 0.5 + 0.62 * smooth01(voids * 1.15);
      density[y * size + x] = clamp01(value * 1.45);
    }
  }

  const canvases = tints.map(([r, g, b]) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d')!;
    const image = context.createImageData(size, size);
    for (let i = 0; i < density.length; i += 1) {
      const alpha = density[i];
      if (alpha < 0.004) continue;
      const shade = 0.82 + alpha * 0.34;
      const offset = i * 4;
      image.data[offset] = Math.min(255, r * shade);
      image.data[offset + 1] = Math.min(255, g * shade);
      image.data[offset + 2] = Math.min(255, b * shade);
      image.data[offset + 3] = Math.round(alpha * 255);
    }
    context.putImageData(image, 0, 0);
    return canvas;
  });

  return canvases;
}

function build(size: number, count: number): SpriteSet {
  return {
    size,
    shapes: Array.from({ length: count }, (_, index) => paintShape(size, index, TINTS)),
  };
}

/** Build lazily, off the first paint, and cache for the whole session. */
export function getSpriteSet(mobile: boolean): SpriteSet {
  if (mobile) {
    if (!mobileSet) mobileSet = build(144, 4);
    return mobileSet;
  }
  if (!desktopSet) desktopSet = build(208, 6);
  return desktopSet;
}

export function spriteSetReady(mobile: boolean): boolean {
  return mobile ? mobileSet !== null : desktopSet !== null;
}

export function prepareSpriteSet(mobile: boolean): Promise<SpriteSet> {
  return new Promise((resolve) => {
    const buildNow = () => resolve(getSpriteSet(mobile));
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => void })
      .requestIdleCallback;
    if (typeof idle === 'function') idle(buildNow, { timeout: 1200 });
    else window.setTimeout(buildNow, 60);
  });
}

export function tintIndex(tone: number, random: number): number {
  const index = Math.round(tone * 3 + random * 1.15 - 0.35);
  return Math.max(0, Math.min(TINTS.length - 1, index));
}

export { TINTS };

/** Deterministic puff descriptors, generated once per viewport class. */
export interface Puff {
  x: number;
  y: number;
  dir: number;
  scale: number;
  rotation: number;
  spin: number;
  shape: number;
  tint: number;
  stagger: number;
  wobble: number;
}

export function buildPuffs(count: number, layerSeed: number, tintBias: number): Puff[] {
  return Array.from({ length: count }, (_, index) => {
    const base = index * 7.13 + layerSeed * 101.7;
    return {
      x: h01(base),
      y: 0.1 + Math.pow(h01(base + 1.7), 0.85) * 0.86,
      dir: h01(base + 2.3) > 0.5 ? 1 : -1,
      scale: 0.72 + h01(base + 3.9) * 0.72,
      rotation: (h01(base + 5.1) - 0.5) * 1.1,
      spin: (h01(base + 6.7) - 0.5) * 0.7,
      shape: Math.floor(h01(base + 8.3) * 97) % 6,
      tint: tintBias + Math.floor(h01(base + 9.9) * 2),
      stagger: h01(base + 11.3) * 0.075,
      wobble: h01(base + 13.7) * Math.PI * 2,
    };
  });
}
