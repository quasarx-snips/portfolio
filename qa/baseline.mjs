// Baseline gate measurement, production build.
// Drives the real boot -> prologue -> handover -> first-scroll path via CDP and
// records wall-clock milestones. Deterministic input via __cosmos press().
const DEBUG = 'http://localhost:9222';
const URL_ = process.env.TARGET_URL || 'http://localhost:4173/';

const list = await (await fetch(`${DEBUG}/json`)).json();
let page = list.find((t) => t.type === 'page' && !t.url.startsWith('devtools'));
if (!page) {
  const created = await (await fetch(`${DEBUG}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
  page = created;
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
const evalJs = async (expr) => {
  const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return res.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Runtime.enable');
await send('Page.enable');

const t0 = Date.now();
await send('Page.navigate', { url: URL_ });

// Milestone 1: boot gate opens (phase 'ready' + veil starts fading).
let gateOpenMs = null;
let gateReadyMs = null;
for (let i = 0; i < 400; i++) {
  await sleep(100);
  const s = await evalJs(`(() => {
    const veil = document.querySelector('.boot');
    return JSON.stringify({
      phase: window.__cosmos ? 'cosmos-mounted' : 'waiting',
      veilUp: !!veil,
      veilExiting: !!(veil && veil.className.includes('exiting')),
      cosmos: !!document.querySelector('.cosmos'),
    });
  })()`);
  const st = JSON.parse(s);
  if (st.cosmos && gateReadyMs === null) gateReadyMs = Date.now() - t0; // children mounted behind veil
  if (st.veilExiting && gateOpenMs === null) gateOpenMs = Date.now() - t0;
  if (gateOpenMs !== null) break;
}

const afterGate = await evalJs(`JSON.stringify({
  scrollY: window.scrollY,
  docH: document.documentElement.scrollHeight,
  htmlOverflow: document.documentElement.style.overflow || '(default)',
  locked: true,
})`);

// Milestone 2: commit the fall (press+hold), poll until scroll is unlocked.
await evalJs('window.__cosmos && window.__cosmos.press()');
await sleep(900);
await evalJs('window.__cosmos && window.__cosmos.release()');

let scrollUnlockedMs = null;
let filmVisibleMs = null;
for (let i = 0; i < 300; i++) {
  await sleep(100);
  const s = await evalJs(`JSON.stringify({
    cosmos: !!document.querySelector('.cosmos'),
    cinematic: !!document.querySelector('.cinematic'),
    htmlOverflow: document.documentElement.style.overflow || '(default)',
  })`);
  const st = JSON.parse(s);
  if (st.cosmos && st.cinematic && filmVisibleMs === null) filmVisibleMs = Date.now() - t0;
  if (!st.cosmos && st.cinematic && st.htmlOverflow === '(default)' && scrollUnlockedMs === null) {
    scrollUnlockedMs = Date.now() - t0;
    break;
  }
  if (scrollUnlockedMs !== null) break;
}

// Milestone 3: can the visitor actually scroll now?
let scrolled = false;
let scrollTries = 0;
while (!scrolled && scrollTries < 10) {
  scrollTries++;
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 400, y: 300, deltaY: 400 });
  await sleep(200);
  const y = await evalJs('window.scrollY');
  if (y > 0) scrolled = true;
}
const firstScrollMs = scrolled ? Date.now() - t0 : null;

// Milestone 4: film state after a big scroll.
await evalJs(`window.scrollTo(0, window.innerHeight * 3)`);
await sleep(600);
const filmState = await evalJs(`JSON.stringify({
  scrollY: window.scrollY,
  progress: window.__palace ? Number(window.__palace.progress().toFixed(4)) : null,
  docH: document.documentElement.scrollHeight,
  viewH: window.innerHeight,
})`);

console.log(JSON.stringify({
  url: URL_,
  gateReadyMs,      // children mounted behind veil (first frame of App)
  gateOpenMs,       // veil starts fading
  filmVisibleMs,    // cosmos covered + film mounted (still holding)
  scrollUnlockedMs, // prologue overlay gone, overflow restored
  firstScrollMs,    // first successful wheel scroll
  afterGate,
  filmState,
}, null, 2));

ws.close();
process.exit(0);
