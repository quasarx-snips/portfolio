#!/usr/bin/env node
/**
 * qa/screenshot-harness/capture.mjs — visual QA screenshot harness for "The Palace of Many Worlds".
 *
 * Zero npm dependencies. Node 22+ (uses global fetch + global WebSocket).
 * Launches headless Chrome/Edge with the DevTools protocol, drives the debug
 * contract `window.__palace.force(progress)` (dev builds only) and writes PNGs.
 *
 * See qa/screenshot-harness/README.md for usage.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const CHROME_PROFILE_DIR = path.join(PROJECT_ROOT, '.qa', '.chrome-profile');

const DEFAULTS = {
  url: 'http://localhost:5188/',
  out: path.join(PROJECT_ROOT, '.qa', 'shots'),
  width: 1440,
  height: 900,
  prefix: 'desktop',
  settle: 180,
  progress: '0,0.2,0.4,0.6,0.8,0.95,1',
  scroll: null,
  mobile: false,
  reduced: false,
};

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function usage(exitCode) {
  const lines = [
    'Usage: node qa/screenshot-harness/capture.mjs [options]',
    '',
    '  --url=<url>          Page to capture (default: ' + DEFAULTS.url + ')',
    '  --out=<dir>          Output directory for PNGs (default: .qa/shots)',
    '  --width=<px>         Viewport width (default: ' + DEFAULTS.width + ')',
    '  --height=<px>        Viewport height (default: ' + DEFAULTS.height + ')',
    '  --mobile             Emulate mobile (Emulation mobile + touch)',
    '  --reduced            Emulate prefers-reduced-motion: reduce; never calls',
    '                       window.__palace.force(), captures page scroll states',
    '  --progress=<list>    Comma-separated progress values 0..1',
    '                       (default: ' + DEFAULTS.progress + ')',
    '  --scroll=<list>      Comma-separated scrollY pixel offsets; alternative',
    '                       capture mode (page inspection / reduced motion)',
    '  --prefix=<name>      Output file prefix (default: ' + DEFAULTS.prefix + ')',
    '  --settle=<ms>        Settle time after each force/scroll (default: ' + DEFAULTS.settle + ')',
    '  --chrome=<path>      Chrome/Edge executable override',
    '',
    'Output names:  <prefix>-p<percent>.png   e.g. desktop-p060.png (progress 0.6)',
    '               <prefix>-s<pixels>.png    e.g. desktop-s00900.png (scrollY 900)',
  ];
  console.log(lines.join('\n'));
  process.exit(exitCode);
}

function parseArgs(argv) {
  const opts = { ...DEFAULTS };
  let chromeOverride = null;
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') usage(0);
    let key = raw;
    let value = null;
    const eq = raw.indexOf('=');
    if (raw.startsWith('--') && eq !== -1) {
      key = raw.slice(0, eq);
      value = raw.slice(eq + 1);
    }
    const takeValue = (name) => {
      if (value !== null) return value;
      throw new Error(`Option ${name} requires a value (use ${name}=<value>)`);
    };
    switch (key) {
      case '--url': opts.url = takeValue(key); break;
      case '--out': opts.out = takeValue(key); break;
      case '--width': opts.width = toInt(takeValue(key), 'width'); break;
      case '--height': opts.height = toInt(takeValue(key), 'height'); break;
      case '--prefix': opts.prefix = takeValue(key); break;
      case '--settle': opts.settle = toInt(takeValue(key), 'settle'); break;
      case '--progress': opts.progress = takeValue(key); break;
      case '--scroll': opts.scroll = takeValue(key); break;
      case '--chrome': chromeOverride = takeValue(key); break;
      case '--mobile': opts.mobile = true; break;
      case '--reduced': opts.reduced = true; break;
      default:
        throw new Error(`Unknown option: ${raw} (see --help)`);
    }
  }
  if (!/^https?:\/\/|^file:\/\//.test(opts.url)) {
    throw new Error(`--url must be http(s):// or file:// — got: ${opts.url}`);
  }
  if (opts.width < 320 || opts.height < 320) {
    throw new Error(`--width/--height must be >= 320 — got ${opts.width}x${opts.height}`);
  }
  if (opts.settle < 0) throw new Error('--settle must be >= 0');
  if (!/^[A-Za-z0-9._-]+$/.test(opts.prefix)) {
    throw new Error(`--prefix must be filename-safe (letters, digits, . _ -) — got: ${opts.prefix}`);
  }
  return { opts, chromeOverride };
}

function toInt(text, name) {
  const n = Number(text);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`--${name} must be an integer — got: ${text}`);
  }
  return n;
}

function toNumberList(text, name) {
  return text.split(',').map((part) => {
    const trimmed = part.trim();
    const n = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(n)) {
      throw new Error(`--${name} must be a comma-separated list of numbers — got: ${text}`);
    }
    return n;
  });
}

// ---------------------------------------------------------------------------
// Chrome discovery / process management
// ---------------------------------------------------------------------------

function findChrome(override) {
  if (override) {
    if (!existsSync(override)) {
      throw new Error(`--chrome path does not exist: ${override}`);
    }
    return path.resolve(override);
  }
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    'No Chrome/Edge executable found. Tried:\n  ' +
      CHROME_CANDIDATES.join('\n  ') +
      '\nPass --chrome=<path> to override.'
  );
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function launchChrome(chromePath, port, width, height) {
  mkdirSync(CHROME_PROFILE_DIR, { recursive: true });
  const args = [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${CHROME_PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    '--allow-file-access-from-files',
    // Software WebGL so canvas scenes render in headless QA runs.
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--remote-allow-origins=*',
    'about:blank',
  ];
  const child = spawn(chromePath, args, {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  const stderrChunks = [];
  child.stderr.on('data', (chunk) => {
    stderrChunks.push(chunk);
    if (stderrChunks.length > 200) stderrChunks.shift();
  });
  const stderrText = () => Buffer.concat(stderrChunks).toString('utf8').slice(-4000);
  return { child, stderrText };
}

let activeChrome = null; // so process-exit handlers can always reap Chrome

async function killChrome(child) {
  if (!child || child.exitCode !== null) return;
  try { child.kill('SIGTERM'); } catch { /* already gone */ }
  await delay(2000);
  if (child.exitCode === null) {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
    if (process.platform === 'win32' && child.pid) {
      try {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch { /* best effort */ }
    }
  }
}

function reapChromeSync() {
  const child = activeChrome;
  activeChrome = null;
  if (!child || child.exitCode !== null) return;
  try { child.kill('SIGKILL'); } catch { /* already gone */ }
  if (process.platform === 'win32' && child.pid) {
    try {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch { /* best effort */ }
  }
}

// ---------------------------------------------------------------------------
// Minimal CDP client over WebSocket
// ---------------------------------------------------------------------------

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map(); // id -> {resolve, reject, timer}
    this.listeners = new Map(); // event name -> Set<{fn, sessionId}>
    this.closed = false;

    ws.addEventListener('message', (ev) => this.#onMessage(ev.data));
    ws.addEventListener('close', () => this.#onClose('CDP WebSocket closed'));
    ws.addEventListener('error', () => this.#onClose('CDP WebSocket error'));
  }

  static connect(wsUrl, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { ws.close(); } catch { /* ignore */ }
          reject(new Error(`Timed out connecting to DevTools WebSocket after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      ws.addEventListener('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(new CdpClient(ws));
      });
      ws.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to connect to DevTools WebSocket: ${wsUrl}`));
      });
    });
  }

  #onMessage(raw) {
    const handle = (text) => {
      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (typeof msg.id === 'number') {
        const entry = this.pending.get(msg.id);
        if (!entry) return;
        this.pending.delete(msg.id);
        clearTimeout(entry.timer);
        if (msg.error) {
          entry.reject(new Error(`CDP ${entry.method} failed: ${msg.error.message} (code ${msg.error.code})`));
        } else {
          entry.resolve(msg.result ?? {});
        }
        return;
      }
      if (typeof msg.method === 'string') {
        const set = this.listeners.get(msg.method);
        if (!set) return;
        for (const entry of [...set]) {
          if (entry.sessionId && msg.sessionId && entry.sessionId !== msg.sessionId) continue;
          try {
            entry.fn(msg.params ?? {}, msg.sessionId);
          } catch (err) {
            console.error(`[capture] CDP listener for ${msg.method} threw: ${err?.message ?? err}`);
          }
        }
      }
    };
    if (typeof raw === 'string') {
      handle(raw);
    } else if (raw && typeof raw.text === 'function') {
      raw.text().then(handle).catch(() => {});
    } else if (raw instanceof ArrayBuffer) {
      handle(Buffer.from(raw).toString('utf8'));
    }
  }

  #onClose(reason) {
    if (this.closed) return;
    this.closed = true;
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error(`${reason} (waiting for ${entry.method})`));
    }
    this.pending.clear();
    this.listeners.clear();
    try { this.ws.close(); } catch { /* ignore */ }
  }

  send(method, params = {}, sessionId = undefined, timeoutMs = 30000) {
    if (this.closed) return Promise.reject(new Error(`CDP connection already closed (wanted to send ${method})`));
    const id = this.nextId++;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      try {
        this.ws.send(JSON.stringify(message));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new Error(`CDP send(${method}) failed: ${err?.message ?? err}`));
      }
    });
  }

  on(method, fn, sessionId = undefined) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    const entry = { fn, sessionId };
    this.listeners.get(method).add(entry);
    return () => this.listeners.get(method)?.delete(entry);
  }

  once(method, sessionId = undefined, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for CDP event ${method}`));
      }, timeoutMs);
      const unsubscribe = this.on(method, (params) => {
        clearTimeout(timer);
        unsubscribe();
        resolve(params);
      }, sessionId);
    });
  }

  close() {
    this.#onClose('CDP client closed');
  }
}

// ---------------------------------------------------------------------------
// CDP helpers
// ---------------------------------------------------------------------------

async function evaluate(cdp, sessionId, expression, { awaitPromise = false, timeoutMs = 30000 } = {}) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  }, sessionId, timeoutMs);
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails;
    const desc = detail.exception?.description ?? detail.text ?? 'unknown page error';
    throw new Error(`Runtime.evaluate failed: ${desc}`);
  }
  return result.result?.value;
}

function waitForPageLoad(cdp, sessionId, timeoutMs) {
  return cdp.once('Page.loadEventFired', sessionId, timeoutMs);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Two requestAnimationFrame ticks in the page (lets layout/paint settle).
const TWO_RAF = `new Promise((resolve) => {
  if (typeof requestAnimationFrame !== 'function') return resolve(true);
  requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
})`;

async function waitForDebugContract(cdp, sessionId, timeoutMs = 22000) {
  // Poll inside the page (single Runtime.evaluate with awaitPromise).
  const inPageTimeout = timeoutMs - 2000;
  const expr = `new Promise((resolve, reject) => {
  const started = Date.now();
  (function tick() {
    try {
      if (window.__palace && typeof window.__palace.force === 'function') return resolve(true);
    } catch (e) { /* ignore transient errors while app boots */ }
    if (Date.now() - started > ${inPageTimeout}) {
      return reject(new Error('window.__palace.force was not exposed after ' + ${inPageTimeout} + 'ms'));
    }
    setTimeout(tick, 200);
  })();
})`;
  try {
    await evaluate(cdp, sessionId, expr, { awaitPromise: true, timeoutMs });
  } catch (err) {
    throw new Error(
      'The app never exposed the debug contract `window.__palace.force`.\n' +
        '  - window.__palace only exists in dev builds (`npm run dev`).\n' +
        '  - Confirm the page at the --url is this project and fully loaded.\n' +
        `Underlying error: ${err.message}`
    );
  }
}

async function waitForFonts(cdp, sessionId, timeoutMs = 15000) {
  await evaluate(
    cdp,
    sessionId,
    `Promise.race([
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(true), ${timeoutMs - 1000}))
    ])`,
    { awaitPromise: true, timeoutMs }
  );
}

// ---------------------------------------------------------------------------
// Capture logic
// ---------------------------------------------------------------------------

function formatProgressTag(p) {
  return String(Math.round(p * 100)).padStart(3, '0');
}

function formatScrollTag(y) {
  return String(Math.round(y)).padStart(5, '0');
}

async function settlePage(cdp, sessionId, settleMs) {
  if (settleMs > 0) await delay(settleMs);
  await evaluate(cdp, sessionId, TWO_RAF, { awaitPromise: true, timeoutMs: 10000 });
}

async function captureScreenshot(cdp, sessionId) {
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  }, sessionId, 60000);
  if (!shot.data) throw new Error('Page.captureScreenshot returned no data');
  return Buffer.from(shot.data, 'base64');
}

async function run() {
  const { opts, chromeOverride } = parseArgs(process.argv.slice(2));
  const useScrollMode = opts.reduced || opts.scroll !== null;
  const scrollList = opts.scroll !== null ? toNumberList(opts.scroll, 'scroll') : [0];
  const progressList = useScrollMode ? [] : toNumberList(opts.progress, 'progress');
  for (const p of progressList) {
    if (p < 0 || p > 1) throw new Error(`--progress values must be within 0..1 — got ${p}`);
  }
  for (const y of scrollList) {
    if (y < 0) throw new Error(`--scroll values must be >= 0 — got ${y}`);
  }

  const outDir = path.resolve(opts.out);
  mkdirSync(outDir, { recursive: true });

  const chromePath = findChrome(chromeOverride);
  const port = await getFreePort();
  const mode = useScrollMode
    ? `scroll mode (${opts.reduced ? 'reduced-motion, no force() calls' : 'page inspection'})`
    : `progress mode (${progressList.length} steps)`;

  console.log(`[capture] chrome   : ${chromePath}`);
  console.log(`[capture] target   : ${opts.url}`);
  console.log(`[capture] viewport : ${opts.width}x${opts.height}${opts.mobile ? ' (mobile)' : ''}`);
  console.log(`[capture] mode     : ${mode}`);
  console.log(`[capture] output   : ${outDir}`);

  const { child, stderrText } = launchChrome(chromePath, port, opts.width, opts.height);
  activeChrome = child;
  let exitedEarly = false;
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) exitedEarly = true;
  });

  let cdp = null;
  const captured = [];
  try {
    // --- wait for the DevTools endpoint to come up -------------------------
    const versionUrl = `http://127.0.0.1:${port}/json/version`;
    let version = null;
    const startupDeadline = Date.now() + 15000;
    while (Date.now() < startupDeadline) {
      if (child.exitCode !== null) {
        throw new Error(
          `Chrome exited during startup (code ${child.exitCode}). Stderr tail:\n${stderrText() || '(empty)'}`
        );
      }
      try {
        const res = await fetch(versionUrl, { signal: AbortSignal.timeout(1000) });
        if (res.ok) {
          version = await res.json();
          break;
        }
      } catch {
        /* not up yet */
      }
      await delay(250);
    }
    if (!version?.webSocketDebuggerUrl) {
      throw new Error(
        `Chrome DevTools endpoint never became ready on port ${port} within 15s.\n` +
          `Stderr tail:\n${stderrText() || '(empty)'}`
      );
    }

    // --- CDP session (browser ws -> Target.createTarget + attachToTarget) --
    cdp = await CdpClient.connect(version.webSocketDebuggerUrl);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    if (!sessionId) throw new Error('Target.attachToTarget returned no sessionId');

    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: opts.width,
      height: opts.height,
      deviceScaleFactor: 1,
      mobile: opts.mobile,
      screenWidth: opts.width,
      screenHeight: opts.height,
    }, sessionId);
    if (opts.mobile) {
      await cdp.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5,
      }, sessionId);
    }
    if (opts.reduced) {
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      }, sessionId);
    }

    // --- navigate + wait for load ----------------------------------------
    const loadPromise = waitForPageLoad(cdp, sessionId, 30000);
    await cdp.send('Page.navigate', { url: opts.url }, sessionId);
    await loadPromise;
    await waitForFonts(cdp, sessionId);
    if (!opts.reduced) {
      // The contract must exist in dev builds; always verify it (but only
      // *call* force() outside --reduced).
      await waitForDebugContract(cdp, sessionId);
    } else {
      // Scroll/inspection mode without --reduced: still prefer the contract
      // being present, but do not fail hard (page inspection may target
      // anything). Wait briefly instead of the full 20s.
      try {
        await waitForDebugContract(cdp, sessionId, 6000);
      } catch (err) {
        console.warn(`[capture] warn: ${err.message.split('\n')[0]} (continuing, scroll mode)`);
      }
    }

    // --- captures ---------------------------------------------------------
    if (useScrollMode) {
      for (const y of scrollList) {
        await evaluate(cdp, sessionId, `window.scrollTo(0, ${y}); true`, { timeoutMs: 10000 });
        await settlePage(cdp, sessionId, opts.settle);
        const buf = await captureScreenshot(cdp, sessionId);
        const file = path.join(outDir, `${opts.prefix}-s${formatScrollTag(y)}.png`);
        writeFileSync(file, buf);
        captured.push(file);
        console.log(
          `[capture] wrote ${path.basename(file)}  (scrollY=${y}, ${opts.width}x${opts.height}, ${(buf.length / 1024).toFixed(1)} KiB)`
        );
      }
    } else {
      for (const p of progressList) {
        const reported = await evaluate(
          cdp,
          sessionId,
          `(window.__palace.force(${p}), typeof window.__palace.progress === 'function' ? window.__palace.progress() : null)`,
          { timeoutMs: 15000 }
        );
        await settlePage(cdp, sessionId, opts.settle);
        const buf = await captureScreenshot(cdp, sessionId);
        const file = path.join(outDir, `${opts.prefix}-p${formatProgressTag(p)}.png`);
        writeFileSync(file, buf);
        captured.push(file);
        const reportedNote =
          typeof reported === 'number' ? `reported=${reported}` : 'reported=n/a';
        if (typeof reported === 'number' && Math.abs(reported - p) > 0.005) {
          console.warn(`[capture] warn: progress() returned ${reported} for forced ${p}`);
        }
        console.log(
          `[capture] wrote ${path.basename(file)}  (progress=${p}, ${reportedNote}, ${opts.width}x${opts.height}, ${(buf.length / 1024).toFixed(1)} KiB)`
        );
      }
    }

    console.log(
      `[capture] done: ${captured.length} screenshot(s) in ${outDir}` +
        (exitedEarly ? '  [note: chrome exited before shutdown]' : '')
    );
    return captured.length;
  } finally {
    if (cdp) cdp.close();
    await killChrome(child);
    if (activeChrome === child) activeChrome = null;
    if (exitedEarly) {
      console.error(`[capture] chrome stderr tail:\n${stderrText() || '(empty)'}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

if (typeof fetch !== 'function' || typeof WebSocket !== 'function') {
  console.error('[capture] error: Node 22+ is required (global fetch + global WebSocket).');
  process.exit(1);
}

process.on('exit', reapChromeSync);
process.on('uncaughtException', (err) => {
  console.error(`[capture] uncaught exception: ${err?.stack ?? err}`);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error(`[capture] unhandled rejection: ${err?.stack ?? err}`);
  process.exit(1);
});
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`[capture] FAILED: ${err?.message ?? err}`);
    if (process.env.QA_DEBUG && err?.stack) console.error(err.stack);
    process.exit(1);
  });