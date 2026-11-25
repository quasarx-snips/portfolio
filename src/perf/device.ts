/**
 * One authoritative device profile for the whole cinematic.
 *
 * Detection is deliberately conservative: a wrong 'high' costs a weak phone a
 * stuttering prologue, while a wrong 'low' only trims atmosphere. The profile
 * is memoized because probing the GPU creates a canvas; repeated calls are
 * cheap and always return the same object.
 */

export type Tier = 'low' | 'mid' | 'high';

export interface ConnectionInfo {
  /** 'slow-2g' | '2g' | '3g' | '4g', or 'unknown' when the browser hides it. */
  effectiveType: string;
  /** Downlink in Mbps, 0 when unavailable. */
  downlinkMbps: number;
  /** Round-trip time in ms, 0 when unavailable. */
  rttMs: number;
  saveData: boolean;
}

export interface DeviceProfile {
  tier: Tier;
  /** True when we should avoid expensive compositing, not just 3D work. */
  lowPower: boolean;
  /** navigator.deviceMemory, defaulted to 8 when unavailable. */
  memoryGb: number;
  /** navigator.hardwareConcurrency, defaulted to 8. */
  cores: number;
  /** devicePixelRatio clamped to 1..3 so one value can be stored safely. */
  dpr: number;
  touch: boolean;
  reducedMotion: boolean;
  /** Unmasked WebGL renderer when the probe succeeds. */
  gpu: string | null;
  /** Classification of the renderer string, null when unknown. */
  gpuTier: Tier | null;
  connection: ConnectionInfo;
}

/** Chromium-only Network Information API shape; absent elsewhere. */
interface NetworkInformationLike {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface NavigatorWithHints extends Navigator {
  readonly deviceMemory?: number;
  readonly connection?: NetworkInformationLike;
}

interface DebugRendererInfo {
  readonly UNMASKED_RENDERER_WEBGL: number;
}

interface LoseContextExtension {
  loseContext(): void;
}

interface GpuProbeResult {
  gpu: string | null;
  gpuTier: Tier | null;
}

const TIER_ORDER: readonly Tier[] = ['low', 'mid', 'high'];

/**
 * Software rasterisers and pre-2015 mobile/integrated GPUs. Matching the
 * renderer is a heuristic, so these patterns stay specific; anything unknown
 * falls through to high and is then bounded by memory/cores.
 */
const LOW_GPU_PATTERNS: readonly RegExp[] = [
  /swiftshader/,
  /llvmpipe/,
  /softpipe/,
  /software/,
  /microsoft basic/,
  /basic render/,
  /mali-4\d{2}/,
  /mali-t6\d{2}/,
  /adreno[^0-9]{0,8}[34]\d{2}/,
  /powervr[^a-z0-9]*sgx/,
  /hd graphics (?:3000|4000)\b/,
];

const MID_GPU_PATTERNS: readonly RegExp[] = [
  /adreno[^0-9]{0,8}[56]\d{2}/,
  // G5x/G7x are two-digit model numbers; G710/G715 are newer and stay high.
  /mali-g(?:5\d|7\d)(?!\d)/,
  /uhd graphics/,
  /apple a(?:9|10)\b/,
];

const UNKNOWN_CONNECTION: ConnectionInfo = {
  effectiveType: 'unknown',
  downlinkMbps: 0,
  rttMs: 0,
  saveData: false,
};

/** Neutral server profile: touches no DOM and keeps SSR deterministic. */
const SSR_DEVICE: DeviceProfile = Object.freeze({
  tier: 'mid',
  lowPower: true,
  memoryGb: 8,
  cores: 8,
  dpr: 1,
  touch: false,
  reducedMotion: false,
  gpu: null,
  gpuTier: null,
  connection: Object.freeze({ ...UNKNOWN_CONNECTION }),
});

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function positiveInt(value: number | undefined, fallback: number): number {
  const rounded = Math.round(finiteOr(value, fallback));
  return rounded >= 1 ? rounded : fallback;
}

function matches(query: string): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

function normaliseEffectiveType(value: string | undefined): string {
  switch (value) {
    case 'slow-2g':
    case '2g':
    case '3g':
    case '4g':
      return value;
    default:
      return 'unknown';
  }
}

function readConnection(): ConnectionInfo {
  const nav = navigator as NavigatorWithHints;
  const raw = nav.connection;
  if (!raw) return { ...UNKNOWN_CONNECTION };
  return {
    effectiveType: normaliseEffectiveType(raw.effectiveType),
    downlinkMbps: clamp(finiteOr(raw.downlink, 0), 0, 10_000),
    rttMs: clamp(finiteOr(raw.rtt, 0), 0, 60_000),
    saveData: raw.saveData === true,
  };
}

function readDpr(): number {
  if (typeof window === 'undefined') return 1;
  return clamp(finiteOr(window.devicePixelRatio, 1), 1, 3);
}

function classifyGpu(renderer: string): Tier {
  for (const pattern of LOW_GPU_PATTERNS) {
    if (pattern.test(renderer)) return 'low';
  }
  for (const pattern of MID_GPU_PATTERNS) {
    if (pattern.test(renderer)) return 'mid';
  }
  return 'high';
}

function worseTier(a: Tier, b: Tier): Tier {
  return TIER_ORDER.indexOf(a) <= TIER_ORDER.indexOf(b) ? a : b;
}

function hardwareTier(
  memoryGb: number,
  cores: number,
  touch: boolean,
  saveData: boolean,
): Tier {
  if (memoryGb <= 3 || cores <= 3) return 'low';
  if (touch || memoryGb <= 4 || cores <= 4 || saveData) return 'mid';
  return 'high';
}

/**
 * Reads the unmasked renderer, then destroys the probe context synchronously.
 * Browsers only allow a handful of live WebGL contexts, so leaking one here
 * would break the real scene later.
 */
function probeGpu(): GpuProbeResult {
  if (typeof document === 'undefined') return { gpu: null, gpuTier: null };
  let canvas: HTMLCanvasElement | null = null;
  let gl: WebGLRenderingContext | null = null;
  try {
    canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'low-power',
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    });
    if (!gl) return { gpu: null, gpuTier: null };

    const info = gl.getExtension('WEBGL_debug_renderer_info') as DebugRendererInfo | null;
    if (!info) return { gpu: null, gpuTier: null };

    const raw: unknown = gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
    if (typeof raw !== 'string') return { gpu: null, gpuTier: null };

    // Some drivers return very long ANGLE strings; 160 chars is plenty.
    const renderer = raw.trim().toLowerCase().slice(0, 160);
    if (renderer.length === 0) return { gpu: null, gpuTier: null };

    return { gpu: renderer, gpuTier: classifyGpu(renderer) };
  } catch {
    // Privacy modes and blocked contexts are expected; never throw or log.
    return { gpu: null, gpuTier: null };
  } finally {
    if (gl) {
      try {
        const lose = gl.getExtension('WEBGL_lose_context') as LoseContextExtension | null;
        lose?.loseContext();
      } catch {
        // Context teardown is best-effort.
      }
      gl = null;
    }
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
      canvas.remove();
      canvas = null;
    }
  }
}

function createProfile(): DeviceProfile {
  const nav = navigator as NavigatorWithHints;
  const connection = readConnection();
  const memoryGb = clamp(positiveNumber(nav.deviceMemory, 8), 0.25, 64);
  const cores = clamp(positiveInt(nav.hardwareConcurrency, 8), 1, 256);
  const touch = matches('(pointer: coarse)');
  const reducedMotion = matches('(prefers-reduced-motion: reduce)');
  const hardware = hardwareTier(memoryGb, cores, touch, connection.saveData);
  const probe = probeGpu();

  // A poor GPU can make a fast CPU feel worse than its specs suggest.
  const tier = probe.gpuTier ? worseTier(hardware, probe.gpuTier) : hardware;

  // Slow or metered networks are a separate kind of weak: keep the cheap plate
  // even if the GPU could handle the 2000px one.
  const reducedData =
    connection.saveData ||
    connection.effectiveType === 'slow-2g' ||
    connection.effectiveType === '2g';

  return Object.freeze({
    tier,
    lowPower: tier !== 'high' || reducedData,
    memoryGb,
    cores,
    dpr: readDpr(),
    touch,
    reducedMotion,
    gpu: probe.gpu,
    gpuTier: probe.gpuTier,
    connection: Object.freeze(connection),
  });
}

let cachedDevice: DeviceProfile | null = null;

/** Memoized device detection. Safe to call repeatedly and from effects. */
export function detectDevice(): DeviceProfile {
  if (cachedDevice) return cachedDevice;
  // Server render / test environment: neutral profile, no DOM access.
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return SSR_DEVICE;
  cachedDevice = createProfile();
  return cachedDevice;
}

/**
 * Read-only view that resolves `compute()` on first property access. It lets
 * `device` and `quality` stay plain exported consts while still deferring the
 * WebGL probe until the app actually needs it (and never running it in SSR).
 */
export function createLazyView<T extends object>(compute: () => T): T {
  const target: Record<PropertyKey, unknown> = {};
  return new Proxy(target, {
    get: (_target, key) => Reflect.get(compute(), key),
    has: (_target, key) => Reflect.has(compute(), key),
    ownKeys: () => Reflect.ownKeys(compute()),
    // Profiles are frozen, so their own descriptors are non-configurable. A
    // proxy must not report that for a property its (empty) target lacks, so
    // re-declare the descriptor as configurable for Object.keys/JSON/devtools.
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(compute(), key);
      return descriptor ? { ...descriptor, configurable: true } : undefined;
    },
  }) as unknown as T;
}

/** Lazy, memoized device profile; no DOM writes happen at import time. */
export const device: DeviceProfile = createLazyView(detectDevice);

/**
 * Mirrors the profile onto <html> so CSS can drop expensive blends. Every
 * operation is an idempotent toggle, so calling this before or after paint is
 * equally safe. It does not register listeners; `refreshDeviceClasses` is the
 * hook for resize/orientation handlers.
 */
function syncDeviceClasses(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!root) return;
  const profile = detectDevice();

  root.classList.toggle('tier-low', profile.tier === 'low');
  root.classList.toggle('tier-mid', profile.tier === 'mid');
  root.classList.toggle('tier-high', profile.tier === 'high');
  root.classList.toggle('low-power', profile.lowPower);
  root.classList.toggle('reduced-motion', profile.reducedMotion);

  if (root.dataset.tier !== profile.tier) root.dataset.tier = profile.tier;
}

/** Apply tier/low-power/reduced-motion classes once, before or after paint. */
export function applyDeviceClasses(): void {
  syncDeviceClasses();
}

/** Idempotent re-apply for resize/orientation handlers. */
export function refreshDeviceClasses(): void {
  syncDeviceClasses();
}
