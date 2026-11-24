import { createLazyView, detectDevice, type DeviceProfile, type Tier } from './device';

/** Concrete knobs the render layers consume. One object per device. */
export interface QualityProfile {
  /** Ceiling for canvas backing stores; never above the device DPR. */
  dprCap: number;
  /** Backing-store pixel budget for the prologue. */
  maxPixels: number;
  /** Initial internal resolution scale for the prologue, 0.5..1. */
  prologueScale: number;
  prologueDprCap: number;
  /** Redraw interval (ms) when the prologue is idle, not scrubbing. */
  idleDrawMs: number;
  /** Absolute dust mote count; the engine can map this to its own loop. */
  dustMotes: number;
  /** 0..1 multiplier for smoke/dust particle counts. */
  particleScale: number;
  /** 1..3 smoke particle layers. */
  smokeLayers: number;
  /** DPR cap for the smoke/dust canvases. */
  smokeDpr: number;
  /** Film grain overlay; a full-screen blend, off below high. */
  grain: boolean;
  warmBlend: 'soft-light' | 'normal';
  /** Which temple plate variant to preload. */
  plateWidth: 1280 | 2000;
  /** 60 normally; 30 on the lowest tier so the frame budget is attainable. */
  targetFps: number;
}

type TierQuality = Omit<QualityProfile, 'plateWidth'>;

const BY_TIER: Record<Tier, TierQuality> = {
  // Genuinely cheap: roughly one third of the high-tier pixels per frame.
  low: {
    dprCap: 1.15,
    maxPixels: 380_000,
    prologueScale: 0.6,
    prologueDprCap: 1.15,
    idleDrawMs: 120,
    dustMotes: 24,
    particleScale: 0.5,
    // Two layers keep the roll readable; the 0.5 particle scale does the
    // real saving without flattening the silhouette entirely.
    smokeLayers: 2,
    smokeDpr: 1,
    grain: false,
    warmBlend: 'normal',
    targetFps: 30,
  },
  // Retina phones and 4-core laptops: full layout, trimmed atmosphere.
  mid: {
    dprCap: 1.5,
    maxPixels: 900_000,
    prologueScale: 0.8,
    prologueDprCap: 1.5,
    idleDrawMs: 66,
    dustMotes: 40,
    particleScale: 0.75,
    smokeLayers: 2,
    smokeDpr: 1.25,
    // Grain is a full-screen overlay blend; not worth it on a mid GPU.
    grain: false,
    warmBlend: 'soft-light',
    targetFps: 60,
  },
  // Desktop: the intended look.
  high: {
    dprCap: 2,
    maxPixels: 2_100_000,
    prologueScale: 1,
    prologueDprCap: 2,
    idleDrawMs: 33,
    dustMotes: 66,
    particleScale: 1,
    smokeLayers: 3,
    smokeDpr: 1.75,
    grain: true,
    warmBlend: 'soft-light',
    targetFps: 60,
  },
};

/**
 * 2000px only where the extra detail can actually be seen, and never on a
 * metered or 2G connection. Everything else gets the 1280 plate.
 */
function plateWidthFor(profile: DeviceProfile): 1280 | 2000 {
  if (profile.tier !== 'high') return 1280;

  const { connection } = profile;
  if (
    connection.saveData ||
    connection.effectiveType === 'slow-2g' ||
    connection.effectiveType === '2g'
  ) {
    return 1280;
  }

  const viewport = typeof window === 'undefined' ? 0 : window.innerWidth;
  if (!(viewport > 0)) return profile.dpr >= 1.5 ? 2000 : 1280;
  return viewport * profile.dpr >= 1600 ? 2000 : 1280;
}

const cache = new WeakMap<DeviceProfile, QualityProfile>();

/** Maps a profile onto render budgets. Memoized per profile object. */
export function qualityFor(profile: DeviceProfile): QualityProfile {
  const cached = cache.get(profile);
  if (cached) return cached;

  const quality: QualityProfile = Object.freeze({
    ...BY_TIER[profile.tier],
    plateWidth: plateWidthFor(profile),
  });
  cache.set(profile, quality);
  return quality;
}

/** Lazy quality for the memoized device profile; no DOM work until read. */
export const quality: QualityProfile = createLazyView(() => qualityFor(detectDevice()));
