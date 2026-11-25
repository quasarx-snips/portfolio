import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import BootGate from './ui/boot/BootGate';
import { startBoot } from './load/boot';
import { buildManifest } from './load/manifest';
import { applyDeviceClasses, device, quality } from './perf';

/**
 * Entry point.
 *
 * The shell (tokens + boot screen) is static and tiny; the site itself is a
 * lazy chunk the boot scheduler fetches in the background. The order matters:
 * apply the device classes first so CSS is honest from the first paint, paint
 * the loader, then start the scheduler. The gate owns the handover.
 */
const App = lazy(() => import('./App'));

applyDeviceClasses();

const params = new URLSearchParams(window.location.search);
// Deterministic visual QA and explicit opt-out skip the gate entirely.
const skipBoot = params.has('p') || params.get('boot') === 'skip';
const reducedMotion =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = window.matchMedia('(max-width: 760px)').matches;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BootGate skip={skipBoot}>
      <Suspense fallback={null}>
        <App />
      </Suspense>
    </BootGate>
  </StrictMode>,
);

if (!skipBoot) {
  const manifest = buildManifest({
    dpr: device.dpr,
    dprCap: quality.dprCap,
    plateWidthCap: quality.plateWidth,
    mobile,
    reducedData: device.connection.saveData,
    reducedMotion,
    viewportWidth: window.innerWidth,
    basePath: import.meta.env.BASE_URL,
  });

  startBoot({
    ...manifest,
    firstPage: 'prologue',
    // Everything critical is fetched before the veil lifts; on a slow link the
    // soft deadline lets the visitor in once the first screen is genuinely
    // ready, while the decorative tail keeps loading silently.
    revealOnCritical: true,
    softTimeoutMs: 8_000,
    hardTimeoutMs: 20_000,
    minDurationMs: 900,
  });
}
