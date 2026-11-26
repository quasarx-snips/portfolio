// Gate timing on the PRODUCTION preview. Desktop viewport, real boot flow.
const DEBUG = 'http://localhost:9222';
const URL_ = process.env.TARGET_URL || 'http://localhost:4173/';
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

let firstPaintMs = null, gateReadyMs = null, gateOpenMs = null, veilGoneMs = null;
for (let i = 0; i < 400; i++) {
  await sleep(50);
  const s = JSON.parse(await evalJs(`JSON.stringify({
    bootShell: !!document.querySelector('.boot-shell'),
    veil: !!document.querySelector('.boot'),
    exiting: !!(document.querySelector('.boot') && document.querySelector('.boot').className.includes('exiting')),
    cosmos: !!document.querySelector('.cosmos'),
  })`));
  if (!s.bootShell && firstPaintMs === null) firstPaintMs = Date.now() - t0;
  if (s.cosmos && gateReadyMs === null) gateReadyMs = Date.now() - t0;
  if (s.exiting && gateOpenMs === null) gateOpenMs = Date.now() - t0;
  if (!s.veil && gateOpenMs !== null && veilGoneMs === null) veilGoneMs = Date.now() - t0;
  if (veilGoneMs !== null) break;
}
// Reveal completes when the veil is gone; interactive prologue = veilGone.
console.log(JSON.stringify({
  bootShellReplacedMs: firstPaintMs,
  appMountedBehindVeilMs: gateReadyMs,
  veilFadeStartMs: gateOpenMs,
  prologueInteractiveMs: veilGoneMs,
}, null, 2));
ws.close(); process.exit(0);
