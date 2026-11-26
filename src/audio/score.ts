/**
 * The score, as pure math.
 *
 * Same contract as `frame.ts` and `temple/geometry.ts`: no clock, no DOM, no
 * randomness. A still scroll position is a still chord, and scrolling back
 * retraces the harmony exactly. The engine is the only thing that turns these
 * numbers into oscillators.
 *
 * One drone in D (Sa) runs under the whole visit. The film opens and closes it
 * section by section, the door resolves the pad out of the fog, and the
 * corridor keeps the drone while a single voice walks up the raga, one room at
 * a time. Everything is just intonation, so the drone never beats against the
 * moving voice.
 */

import { clamp01, smoothstep } from '../cine/easing';

/** Sa: D2. The whole piece is built from ratios against this one note. */
export const SA_HZ = 73.416;

/** Yaman, as just ratios against Sa: Sa Re Ga tMa Pa Dha Ni. */
export const RATIOS = {
  sa: 1,
  re: 9 / 8,
  ga: 5 / 4,
  tma: 45 / 32,
  pa: 3 / 2,
  dha: 5 / 3,
  ni: 15 / 8,
} as const;

export type Step = keyof typeof RATIOS;

export interface DroneVoice {
  step: Step;
  octave: number;
  gain: number;
  /** -1..1, so the drone sits across the frame instead of in a point. */
  pan: number;
}

/**
 * Sa, Pa, Sa above, and a quiet Pa an octave up. The top voice is what keeps
 * the drone present on a phone speaker, which cannot reproduce the 73 Hz
 * fundamental at all.
 */
export const DRONE: readonly DroneVoice[] = [
  { step: 'sa', octave: 0, gain: 0.46, pan: -0.22 },
  { step: 'pa', octave: 0, gain: 0.26, pan: 0.28 },
  { step: 'sa', octave: 1, gain: 0.15, pan: -0.08 },
  { step: 'pa', octave: 1, gain: 0.1, pan: 0.18 },
];

/** The pad the threshold opens: Sa Ga Pa Ni, a major seventh on the drone. */
export const PAD: readonly { step: Step; octave: number; gain: number }[] = [
  { step: 'sa', octave: 1, gain: 0.34 },
  { step: 'ga', octave: 1, gain: 0.22 },
  { step: 'pa', octave: 1, gain: 0.2 },
  { step: 'ni', octave: 1, gain: 0.14 },
];

/** Everything the engine needs for one moment, already normalised. */
export interface Mix {
  /** Drone weight, 0..1. */
  drone: number;
  /** Lowpass on the drone and pad, in Hz. Opens as the film clarifies. */
  bright: number;
  air: number;
  airTone: number;
  /** The threshold pad, 0..1. */
  pad: number;
  /** Sub octave under the black hole, 0..1. */
  sub: number;
  /** The corridor's room tone, 0..1. */
  room: number;
  /** High sustained shimmer, 0..1. */
  shimmer: number;
}

const SILENT: Mix = { drone: 0, bright: 600, air: 0, airTone: 700, pad: 0, sub: 0, room: 0, shimmer: 0 };

function mixOf(partial: Partial<Mix>): Mix {
  return { ...SILENT, ...partial };
}

/**
 * The film's score. The drone is present from the first frame; the names open
 * the filter, the fog closes it again and takes the drone down with it, and the
 * door brings both back brighter than before, with the pad swelling underneath.
 */
export function filmMix(p: number): Mix {
  const x = clamp01(p);
  const names = smoothstep(x, 0.36, 0.5);
  const fog = smoothstep(x, 0.76, 0.87);
  const door = smoothstep(x, 0.86, 0.95);

  const coverage = smoothstep(x, 0.8, 0.9) * (1 - smoothstep(x, 0.9, 0.975));

  return mixOf({
    drone: 0.46 + 0.16 * names - 0.13 * fog + 0.17 * door,
    bright: 760 + 640 * names - 300 * fog + 980 * door,
    air: 0.012 + 0.2 * coverage,
    airTone: 620 + 520 * coverage,
    pad: smoothstep(x, 0.845, 0.955),
    // The trio holds one shimmer, the door another; the fog has none.
    shimmer:
      0.34 * smoothstep(x, 0.575, 0.63) * (1 - smoothstep(x, 0.66, 0.74)) + 0.3 * door,
  });
}

/** The black hole, before the film has a frame to drive: low, dark, wide. */
export function prologueMix(): Mix {
  return mixOf({ drone: 0.42, bright: 560, air: 0.03, airTone: 520, sub: 0.45 });
}

/**
 * The corridor. The drone stays where the film left it and the air pulls back
 * to a breath, so the hall is the same room, quieter.
 */
export function corridorMix(depth: number): Mix {
  const walk = clamp01(depth / 6);
  return mixOf({
    drone: 0.38,
    bright: 1080 + 260 * walk,
    air: 0.012,
    airTone: 560,
    room: 0.55,
    pad: 0.18,
  });
}

export interface Cue {
  /** Film progress the cue is struck at. */
  at: number;
  step: Step;
  octave: number;
  gain: number;
}

/** One struck note per name arriving, then the threshold's bell. */
export const FILM_CUES: readonly Cue[] = [
  { at: 0.404, step: 're', octave: 1, gain: 0.5 },
  { at: 0.5, step: 'ga', octave: 1, gain: 0.5 },
  { at: 0.566, step: 'pa', octave: 1, gain: 0.55 },
  { at: 0.604, step: 'ni', octave: 1, gain: 0.4 },
  { at: 0.752, step: 'dha', octave: 0, gain: 0.5 },
  { at: 0.87, step: 'sa', octave: 0, gain: 0.95 },
  { at: 0.872, step: 'ga', octave: 1, gain: 0.38 },
];

/**
 * The corridor's walk: each room lifts the voice one degree, then octave, then
 * back to Ga for the last room, so the hall resolves rather than climbs away.
 */
const ROOM_WALK: readonly Step[] = ['sa', 're', 'ga', 'pa', 'dha', 'ni', 'sa', 'ga'];

export function roomStep(index: number): Step {
  const wrapped = ((index % ROOM_WALK.length) + ROOM_WALK.length) % ROOM_WALK.length;
  return ROOM_WALK[wrapped] as Step;
}

/** The room's note in Hz, an octave above the drone so it reads as a bell. */
export function roomHz(index: number): number {
  return SA_HZ * RATIOS[roomStep(index)] * 2;
}