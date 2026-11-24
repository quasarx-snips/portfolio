/**
 * Small, signal-aware loading primitives shared by the boot manifest.
 * Everything here resolves only when the resource is genuinely usable —
 * images are decoded, fonts are parsed — so the first painted frame is never
 * a half-ready one.
 */

export interface ImageLoadOptions {
  highPriority?: boolean;
  signal?: AbortSignal;
}

function abortError(): Error {
  return typeof DOMException !== 'undefined'
    ? new DOMException('The load was aborted.', 'AbortError')
    : new Error('The load was aborted.');
}

/** Fetch and decode an image. */
export function preloadImage(url: string, options: ImageLoadOptions = {}): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  const { highPriority = false, signal } = options;
  if (signal?.aborted) return Promise.reject(abortError());

  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    if (highPriority) {
      (image as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'high';
    }

    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener('abort', onAbort);
    };

    const done = () => {
      cleanup();
      resolve();
    };

    const fail = () => {
      cleanup();
      reject(new Error(`Image failed to load: ${url}`));
    };

    const onAbort = () => {
      cleanup();
      image.src = '';
      reject(abortError());
    };

    image.onload = () => {
      // decode() rejects for broken images; treat that as a failed load so the
      // page can fall back instead of waiting for a timeout.
      if (typeof image.decode === 'function') image.decode().then(done, fail);
      else done();
    };
    image.onerror = fail;
    signal?.addEventListener('abort', onAbort, { once: true });
    image.src = url;
  });
}

/** Resolve once the named faces are parsed, or after a short grace period. */
export function waitForFont(spec: string, timeoutMs = 6000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  let timer: number | null = null;
  const timeout = new Promise<void>((resolve) => {
    timer = window.setTimeout(resolve, timeoutMs);
  });
  const load = document.fonts.load(spec).then(
    () => undefined,
    () => undefined,
  );
  return Promise.race([load, timeout]).finally(() => {
    if (timer !== null) window.clearTimeout(timer);
  }) as Promise<void>;
}

/** Cooperative yield, used for cheap background work. */
export function nextIdle(timeoutMs = 120): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const requestIdle = (
    window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  return new Promise<void>((resolve) => {
    if (requestIdle) requestIdle(() => resolve(), { timeout: timeoutMs });
    else window.setTimeout(resolve, 32);
  });
}

/**
 * Pick the temple plate the browser would pick, so the boot preload and the
 * later <img srcset> resolve to the same cache entry.
 */
export function choosePlateWidth(
  viewportWidth: number,
  dpr: number,
  dprCap: number,
  cap: 1280 | 2000,
): 1280 | 2000 {
  if (cap === 1280) return 1280;
  const needed = viewportWidth * Math.min(Math.max(dpr, 1), Math.max(dprCap, 1));
  return needed > 1280 ? 2000 : 1280;
}
