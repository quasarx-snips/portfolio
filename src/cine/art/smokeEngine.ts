import { mix, smoothstep } from '../easing';
import { quality } from '../../perf';
import type { Frame } from '../frame';
import { clamp01, smooth01 } from './noise';
import {
  buildPuffs,
  getSpriteSet,
  prepareSpriteSet,
  spriteSetReady,
  tintIndex,
  type Puff,
} from './smokeSprites';

export type SmokePart = 'back' | 'front';

interface Layer {
  key: 'back' | 'mid' | 'front';
  part: SmokePart;
  count: number;
  size: readonly [number, number];
  alpha: number;
  speed: number;
  inA: number;
  inB: number;
  seed: number;
  tintBias: number;
}

const LAYERS: readonly Layer[] = [
  // Background: broad, diffuse weather that reads as atmospheric haze.
  { key: 'back', part: 'back', count: 20, size: [0.8, 1.38], alpha: 0.17, speed: 0.42, inA: 0.66, inB: 0.8, seed: 1, tintBias: 0 },
  // Middle: smaller, denser puffs carry the visible curls and turbulence.
  { key: 'mid', part: 'back', count: 34, size: [0.3, 0.68], alpha: 0.24, speed: 0.9, inA: 0.69, inB: 0.84, seed: 2, tintBias: 1 },
  // Foreground: fewer, wider wisps that pass closest to the type.
  { key: 'front', part: 'front', count: 26, size: [0.58, 1.12], alpha: 0.22, speed: 1.2, inA: 0.722, inB: 0.88, seed: 3, tintBias: 1 },
];

const puffCache = new Map<string, Puff[]>();

function puffsFor(layer: Layer, mobile: boolean): Puff[] {
  const key = `${layer.key}-${mobile ? 'm' : 'd'}`;
  let puffs = puffCache.get(key);
  if (!puffs) {
    const count = Math.max(
      4,
      Math.round(layer.count * (mobile ? 0.68 : 1) * quality.particleScale),
    );
    puffs = buildPuffs(count, layer.seed, layer.tintBias);
    puffCache.set(key, puffs);
  }
  return puffs;
}

/** Warm ivory at the end, cool stone-grey at the start. */
export function smokeColour(tone: number, bright: number): [number, number, number] {
  const luminance = clamp01(0.24 + tone * 0.5 + bright * 0.4);
  return [mix(150, 250, luminance), mix(146, 247, luminance), mix(138, 240, luminance)];
}

function rgba(rgb: readonly [number, number, number], alpha: number): string {
  return `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, ${alpha.toFixed(4)})`;
}

export function prepareSmoke(mobile: boolean): Promise<void> {
  return prepareSpriteSet(mobile).then(() => undefined);
}

export function smokeReady(mobile: boolean): boolean {
  return spriteSetReady(mobile);
}

/**
 * Paints one smoke layer. All motion is derived from `frame.p`, so a held frame
 * is a held frame and reverse scrolling retraces the same shapes.
 */
export function drawSmoke(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: Frame,
  part: SmokePart,
  mobile: boolean,
  scale = 1,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width * scale, height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (!spriteSetReady(mobile)) return;

  const { smoke } = frame;
  const p = frame.p;
  const rgb = smokeColour(smoke.tone, smoke.bright);
  const coverage = smoke.coverage;

  if (part === 'back') {
    const alpha = 0.24 * smoke.back * (0.35 + coverage * 0.65);
    if (alpha > 0.003) {
      const gradient = ctx.createLinearGradient(0, height * 0.2, 0, height);
      gradient.addColorStop(0, rgba(rgb, 0));
      gradient.addColorStop(0.55, rgba(rgb, alpha * 0.7));
      gradient.addColorStop(1, rgba(rgb, alpha));
      ctx.globalAlpha = 1;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    // The front pass is the one that actually envelops the visitor.
    const alpha = clamp01(0.44 * Math.pow(coverage, 1.12) + 0.14 * smoke.bright * coverage);
    if (alpha > 0.003) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, rgba([rgb[0] * 0.96, rgb[1] * 0.96, rgb[2] * 0.95], alpha * 0.92));
      gradient.addColorStop(0.52, rgba(rgb, alpha));
      gradient.addColorStop(1, rgba([Math.min(255, rgb[0] * 1.01), rgb[1], rgb[2] * 0.99], alpha));
      ctx.globalAlpha = 1;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    // A soft veil that crosses the name where the letters are being absorbed.
    const veil = smoothstep(p, 0.72, 0.86) * 0.5;
    if (veil > 0.003) {
      const gradient = ctx.createLinearGradient(0, height * 0.2, 0, height * 0.84);
      gradient.addColorStop(0, rgba(rgb, 0));
      gradient.addColorStop(0.42, rgba(rgb, veil * 0.85));
      gradient.addColorStop(0.62, rgba(rgb, veil));
      gradient.addColorStop(1, rgba(rgb, 0));
      ctx.globalAlpha = 1;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
  }

  const sprites = getSpriteSet(mobile);
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  for (const layer of LAYERS) {
    if (layer.part !== part) continue;
    // The front plane is the first thing an older GPU can afford to lose:
    // its puffs are the widest sprites and the least legible silhouette.
    if (layer.part === 'front' && quality.smokeLayers < 3) continue;
    const base = layer.size[0];
    const span = layer.size[1] - layer.size[0];
    const growth = 0.78 + 0.5 * p;

    for (const puff of puffsFor(layer, mobile)) {
      const local = smoothstep(p, layer.inA + puff.stagger, layer.inB + puff.stagger);
      if (local <= 0.004) continue;

      const drift = (p - 0.6) * layer.speed;
      const x =
        (puff.x + drift * 0.46 * puff.dir) * width +
        Math.sin(puff.wobble + p * 3.1) * width * 0.018;
      const y =
        (0.08 + puff.y * 0.86) * height -
        drift * height * 0.16 +
        Math.cos(puff.wobble * 1.7 + p * 2.4) * height * 0.02;

      const size = height * (base + span * puff.scale) * growth;
      const stretch = puff.shape % 3 === 2 ? 1.55 : 1;
      const shapeSet = sprites.shapes[puff.shape % sprites.shapes.length];
      const tint = tintIndex(smoke.tone * 0.9 + smoke.bright * 0.3, (puff.tint % 2) * 0.5);
      const sprite = shapeSet[tint];

      const alpha =
        layer.alpha *
        local *
        (layer.part === 'front' ? 0.62 + 0.5 * coverage : 1) *
        (0.7 + 0.3 * smooth01(puff.scale));

      ctx.globalAlpha = clamp01(alpha);
      const angle = puff.rotation + p * puff.spin;
      ctx.setTransform(
        Math.cos(angle) * stretch * scale,
        Math.sin(angle) * stretch * scale,
        -Math.sin(angle) * scale,
        Math.cos(angle) * scale,
        x * scale,
        y * scale,
      );
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    }
  }

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = 1;

  // A final bloom keeps the brightest smoke from reading as flat paper.
  if (part === 'front' && smoke.bright > 0.05) {
    const bloom = smoothstep(p, 0.79, 0.95) * 0.5;
    const gradient = ctx.createRadialGradient(
      width * 0.5,
      height * 0.44,
      0,
      width * 0.5,
      height * 0.44,
      Math.max(width, height) * 0.72,
    );
    gradient.addColorStop(0, rgba([252, 248, 240], bloom));
    gradient.addColorStop(0.55, rgba([250, 246, 238], bloom * 0.5));
    gradient.addColorStop(1, rgba([248, 246, 240], 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
}
