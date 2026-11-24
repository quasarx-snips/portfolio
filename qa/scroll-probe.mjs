const DEBUG = 'http://localhost:9222';
const URL_ = 'http://localhost:5188/';
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
await send('Page.navigate', { url: URL_ });
let ready = false;
for (let i = 0; i < 200 && !ready; i++) { await sleep(100); ready = await evalJs(`window.__cosmos && window.__cosmos.phase() === 'idle'`); }
await evalJs('window.__cosmos.press()'); await sleep(900); await evalJs('window.__cosmos.release()');
let unlocked = false;
for (let i = 0; i < 300 && !unlocked; i++) { await sleep(100); const ph = await evalJs('window.__cosmos ? window.__cosmos.phase() : "gone"'); if (ph === 'gone' || ph === 'done') unlocked = true; }

// Direct probes after unlock:
const probe1 = await evalJs(`JSON.stringify({
  overflowHtml: document.documentElement.style.overflow || '(default)',
  overflowBody: document.body.style.overflow || '(default)',
  docH: document.documentElement.scrollHeight, viewH: window.innerHeight,
  cinematic: !!document.querySelector('.cinematic'),
  cosmos: !!document.querySelector('.cosmos'),
})`);
// try scrollTo directly
await evalJs('window.scrollTo(0, 500)'); await sleep(300);
const y1 = await evalJs('window.scrollY');
// keyboard scroll
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 });
await sleep(400);
const y2 = await evalJs('window.scrollY');
// wheel event listener presence check
const probe2 = await evalJs(`(() => {
  const st = getComputedStyle(document.documentElement), sb = getComputedStyle(document.body);
  return JSON.stringify({ htmlOverflowY: st.overflowY, bodyOverflowY: sb.overflowY, scrollY: window.scrollY });
})()`);
console.log(JSON.stringify({ unlocked, probe1, scrollTo500Y: y1, afterPageDownY: y2, probe2 }, null, 2));
ws.close(); process.exit(0);
