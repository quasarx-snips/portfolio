/**
 * The film itself: every visible value is a pure function of scroll progress.
 *
 * Nothing in this file reads the clock. When the visitor stops scrolling the
 * frame stops, and when they scroll backwards the frame reverses exactly.
 * That is what makes the sequence scrubbable and testable.
 */

import { clamp01, easeInOutCubic, envelope, easeOutCubic, mix, range, smoothstep } from './easing';

export type ScriptKey = 'en' | 'hi' | 'bn';

export interface NameFrame {
  opacity: number;
  blur: number;
  /** Offset in the composition's own gap units (-1, 0, 1 at full stack). */
  slot: number;
  scale: number;
  /** 0..1, used for the English letter-by-letter emergence. */
  reveal: number;
}

export interface LineFrame {
  opacity: number;
  blur: number;
  y: number;
  /** Slight oversize on arrival, settling to 1 as the line finds its place. */
  scale: number;
}

export interface Frame {
  p: number;
  env: {
    opacity: number;
    /** Deep-charcoal veil laid over the illustration at the very beginning. */
    darkness: number;
    zoom: number;
    rise: number;
    light: number;
    haze: number;
    foreground: number;
  };
  dust: { opacity: number; drift: number };
  lines: LineFrame[];
  identity: {
    glow: number;
    sweep: number;
    dissolve: number;
    stack: number;
    subtitle: number;
    dust: number;
    names: Record<ScriptKey, NameFrame>;
  };
  smoke: {
    back: number;
    mid: number;
    front: number;
    coverage: number;
    tone: number;
    bright: number;
  };
  white: number;
  grain: number;
  vignette: number;
  primordial: number;
}

// Each line owns its own window: it arrives, holds, and is gone before the
// next one enters. The first cue starts before p=0 so the opening line is
// already legible on load.
const LINE_CUES: ReadonlyArray<readonly [number, number, number, number]> = [
  [-0.04, 0.012, 0.06, 0.084],
  [0.078, 0.108, 0.138, 0.162],
  [0.156, 0.186, 0.216, 0.24],
  [0.234, 0.264, 0.298, 0.324],
];

const NEGLIGIBLE_LETTERS = new Set([' ', '\u00a0']);

export function countLetters(text: string): number {
  let count = 0;
  for (const char of text) if (!NEGLIGIBLE_LETTERS.has(char)) count += 1;
  return count;
}

export function getFrame(rawP: number): Frame {
  const p = clamp01(rawP);

  /* ------------------------------------------------------------------ Act I */

  const emergence = smoothstep(p, 0.012, 0.228);
  const envOut = smoothstep(p, 0.62, 0.72);
  const approach = easeInOutCubic(range(p, 0.02, 0.4));

  const lines: LineFrame[] = LINE_CUES.map((cue) => {
    const [inA, inB, outA, outB] = cue;
    const entered = easeOutCubic(range(p, inA, inB));
    const leaving = smoothstep(p, outA, outB);
    return {
      opacity: entered * (1 - leaving),
      blur: 10 * (1 - entered) + 6 * leaving,
      y: 24 * (1 - entered) - 16 * leaving,
      scale: mix(1.025, 1, entered) - 0.008 * leaving,
    };
  });

  /* ----------------------------------------------------------------- Act II */

  const identityIn = smoothstep(p, 0.372, 0.43);
  const dissolve = smoothstep(p, 0.74, 0.84);

  // Solo reveals. Deliberately overlapping so no script simply blinks out.
  const soloEn = smoothstep(p, 0.402, 0.46) * (1 - smoothstep(p, 0.492, 0.536));
  const soloHi = smoothstep(p, 0.498, 0.54) * (1 - smoothstep(p, 0.558, 0.6));
  const soloBn = smoothstep(p, 0.562, 0.606);
  const stack = smoothstep(p, 0.598, 0.64);
  const stackEn = smoothstep(p, 0.598, 0.63);
  const stackHi = smoothstep(p, 0.606, 0.64);
  const stackSlot = easeOutCubic(stack);

  const enReveal = range(p, 0.402, 0.474);
  const visible = (opacity: number) => opacity * identityIn * (1 - dissolve);
  const blur = (reveal: number, base = 11) => base * (1 - easeOutCubic(clamp01(reveal))) + 15 * dissolve;

  const names: Record<ScriptKey, NameFrame> = {
    en: {
      opacity: visible(Math.max(soloEn, stackEn)),
      blur: blur(enReveal),
      slot: -stackSlot,
      scale: mix(1, 0.4, stack),
      reveal: enReveal,
    },
    hi: {
      opacity: visible(Math.max(soloHi, stackHi) * 0.94),
      blur: blur(range(p, 0.498, 0.545)),
      slot: 0,
      scale: mix(1, 0.4, stack),
      reveal: range(p, 0.498, 0.552),
    },
    bn: {
      opacity: visible(soloBn * 0.92),
      blur: blur(range(p, 0.562, 0.61)),
      slot: stackSlot,
      scale: mix(1, 0.4, stack),
      reveal: range(p, 0.562, 0.616),
    },
  };

  /* ---------------------------------------------------------------- Act III */

  const back = smoothstep(p, 0.66, 0.79);
  const mid = smoothstep(p, 0.69, 0.83);
  const front = smoothstep(p, 0.722, 0.87);
  const coverage = smoothstep(p, 0.8, 0.91);

  const dust =
    (0.16 + 0.26 * smoothstep(p, 0.02, 0.2) + 0.2 * smoothstep(p, 0.37, 0.45)) *
    (1 - smoothstep(p, 0.66, 0.8));

  const white = smoothstep(p, 0.93, 0.985);

  return {
    p,
    env: {
      opacity: (0.84 + 0.16 * emergence) * (1 - envOut),
      darkness: 0.14 * (1 - smoothstep(p, 0, 0.16)),
      zoom: 1 + 0.2 * approach,
      rise: 10 * approach,
      light: 0.1 + 0.58 * smoothstep(p, 0.03, 0.26) + 0.32 * smoothstep(p, 0.26, 0.44),
      haze: approach,
      foreground: 1 + 0.06 * approach,
    },
    dust: { opacity: dust, drift: p },
    lines,
    identity: {
      glow: smoothstep(p, 0.378, 0.452) * (1 - smoothstep(p, 0.74, 0.83)),
      sweep: range(p, 0.5, 0.65),
      dissolve,
      stack,
      subtitle: smoothstep(p, 0.636, 0.67) * (1 - smoothstep(p, 0.735, 0.785)),
      dust: envelope(p, 0.36, 0.43, 0.62, 0.72),
      names,
    },
    smoke: {
      back,
      mid,
      front,
      coverage,
      tone: smoothstep(p, 0.81, 0.955),
      bright: smoothstep(p, 0.78, 0.96),
    },
    white,
    grain: 0.095 * (1 - smoothstep(p, 0.9, 0.968)),
    vignette: 0.68 * (1 - smoothstep(p, 0.855, 0.93)),
    primordial: 1 - smoothstep(p, 0.03, 0.17),
  };
}
