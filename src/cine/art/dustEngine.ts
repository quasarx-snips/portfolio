import { h01, hash2 } from './noise';
import type { Frame } from '../frame';

/** Original dust: a few dozen warm motes, no image assets involved. */

let dot: HTMLCanvasElement | null = null;
let mote: HTMLCanvasElement | null = null;

function buildDot(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 232, 194, 1)');
  gradient.addColorStop(0.35, 'rgba(247, 210, 158, 0.72)');
  gradient.addColorStop(1, 'rgba(247, 210, 158, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  return canvas;
}

function buildMote(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(96, 96);
  for (let y = 0; y < 96; y += 1) {
    for (let x = 0; x < 96; x += 1) {
      const nx = (x / 96) * 2 - 1;
      const ny = (y / 96) * 2 - 1;
      const r = Math.sqrt(nx * nx + ny * ny);
      const falloff = Math.max(0, 1 - r);
      const value = Math.pow(falloff, 2.2) * (0.5 + 0.5 * hash2(x * 0.4, y * 0.4, 3));
      const offset = (y * 96 + x) * 4;
      image.data[offset] = 246;
      image.data[offset + 1] = 222;
      image.data[offset + 2] = 184;
      image.data[offset + 3] = Math.round(value * 190);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function drawDust(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: Frame,
  mobile: boolean,
  scale = 1,
  particleScale = 1,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width * scale, height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (frame.dust.opacity < 0.004) return;
  if (!dot) dot = buildDot();
  if (!mote) mote = buildMote();

  const count = Math.max(6, Math.round((mobile ? 34 : 66) * particleScale));
  const drift = frame.dust.drift;
  ctx.globalCompositeOperation = 'source-over';

  for (let i = 0; i < count; i += 1) {
    const depth = 0.2 + h01(i * 3.17 + 1) * 0.8;
    const speed = 0.04 + depth * 0.1;
    const direction = h01(i * 9.1) > 0.5 ? 1 : -1;
    let x = h01(i * 7.71) + drift * speed * direction;
    let y = h01(i * 11.37) - drift * speed * 0.55;
    x = ((x % 1) + 1) % 1;
    y = ((y % 1) + 1) % 1;
    y += Math.sin(drift * 6 + i) * 0.004;

    const size = (0.9 + depth * 2.6) * (mobile ? 1 : 1.15) * (0.7 + h01(i * 5.3) * 0.9);
    const alpha = frame.dust.opacity * (0.14 + h01(i * 13.3) * 0.5) * (0.35 + depth * 0.65);
    ctx.globalAlpha = alpha;
    ctx.drawImage(dot, x * width - size, y * height - size, size * 2, size * 2);
  }

  // A handful of out-of-focus motes reading as depth rather than glitter.
  const motes = Math.max(2, Math.round((mobile ? 5 : 9) * particleScale));
  for (let i = 0; i < motes; i += 1) {
    const x = h01(i * 23.1 + 40);
    const y = h01(i * 17.9 + 60);
    const size = 26 + h01(i * 31.7) * 48;
    const alpha = frame.dust.opacity * 0.1 * (0.5 + h01(i * 4.7) * 0.5);
    ctx.globalAlpha = alpha;
    ctx.drawImage(mote, x * width - size / 2, y * height - size / 2, size, size);
  }

  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** 160px seamless-ish film-grain tile, generated once. */
let grainUrl: string | null = null;

export function getGrainUrl(): string {
  if (grainUrl) return grainUrl;
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const n = hash2(x, y, 91);
      const light = n > 0.52;
      const strength = Math.abs(n - 0.5) * 2;
      const offset = (y * size + x) * 4;
      image.data[offset] = light ? 255 : 0;
      image.data[offset + 1] = light ? 252 : 0;
      image.data[offset + 2] = light ? 244 : 6;
      image.data[offset + 3] = Math.round(strength * strength * 150);
    }
  }
  ctx.putImageData(image, 0, 0);
  grainUrl = canvas.toDataURL('image/png');
  return grainUrl;
}
