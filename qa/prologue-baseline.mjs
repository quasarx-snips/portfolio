// Prologue -> first scroll timing on the DEV server (needs window.__cosmos).
const DEBUG = 'http://localhost:9222';
const URL_ = process.env.TARGET_URL || 'http://localhost:5188/';
const list = await (await fetch(`${DEBUG}/json`)).json();
let page = list.find((t) => t.type === 'page' && !t.url.startsWith('devtools'));
if (!page) { page = await (await fetch(`${DEBUG}/json/new?about:blank`, { method: 'PUT' })).json(); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

const t0 = Date.now();
await send('Page.navigate', { url: URL_ });

// Wait until cosmos is mounted and idle.
let ready = false;
for (let i = 0; i < 200 && !ready; i++) { await sleep(100); ready = await evalJs(`window.__cosmos && window.__cosmos.phase() === 'idle'`); }
if (!ready) { console.log(JSON.stringify({ error: 'cosmos never idle' })); process.exit(1); }
const prologueInteractiveMs = Date.now() - t0;

await evalJs('window.__cosmos.press()');
await sleep(900);
await evalJs('window.__cosmos.release()');

let holding = null, revealed = null, unlocked = null, scrolled = false;
for (let i = 0; i < 300; i++) {
  await sleep(100);
  const ph = await evalJs('window.__cosmos.phase()');
  if (ph === 'holding' && holding === null) holding = Date.now() - t0;
  if (ph === 'revealed' && revealed === null) revealed = Date.now() - t0;
  if ((ph === 'done' || ph === null || ph === undefined) && unlocked === null) { unlocked = Date.now() - t0; break; }
}
for (let i = 0; i < 10 && !scrolled; i++) {
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: 400, deltaY: 400 });
  await sleep(150);
  scrolled = (await evalJs('window.scrollY')) > 0;
}
const firstScrollMs = scrolled ? Date.now() - t0 : null;
console.log(JSON.stringify({
  prologueInteractiveMs, // veil gone, press-hold possible
  fallDoneMs: holding,   // white sheet complete
  revealDoneMs: revealed,
  scrollUnlockedMs: unlocked,
  firstScrollMs,
  holdToFirstScrollMs: unlocked !== null ? unlocked - prologueInteractiveMs : null,
}, null, 2));
ws.close(); process.exit(0);
