// Drive the real prologue via CDP: press-hold the black hole, wait for the
// handover, then inspect what the temple page actually looks like.
const DEBUG = 'http://localhost:9223';
const URL_ = 'http://localhost:5188/';

const list = await (await fetch(`${DEBUG}/json`)).json();
let page = list.find((t) => t.type === 'page');
if (!page) {
  const created = await (await fetch(`${DEBUG}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
  page = created;
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pending = new Map();
const consoleMsgs = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === 'Runtime.consoleAPICalled') {
    consoleMsgs.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  } else if (msg.method === 'Runtime.exceptionThrown') {
    consoleMsgs.push('EXCEPTION: ' + JSON.stringify(msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text));
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
await send('Page.navigate', { url: URL_ });
await sleep(6000); // boot + prologue mount

console.log('phase@6s:', await evalJs('window.__cosmos && window.__cosmos.phase()'));
console.log('cosmos present:', await evalJs('!!document.querySelector(".cosmos")'));

// press and hold for > HOLD_MS (720ms)
await evalJs('window.__cosmos && window.__cosmos.press()');
await sleep(1200);
await evalJs('window.__cosmos && window.__cosmos.release()');
console.log('phase after release:', await evalJs('window.__cosmos && window.__cosmos.phase()'));

// ignition 3s + white hold + reveal 0.9s + temple pause 2.6s ≈ 7s; poll
for (let i = 0; i < 12; i++) {
  await sleep(1000);
  const state = await evalJs(`JSON.stringify({
    cosmos: !!document.querySelector('.cosmos'),
    cinematic: !!document.querySelector('.cinematic'),
    world: !!document.querySelector('.world'),
    worldReady: !!document.querySelector('.world.is-ready'),
    scrollY: window.scrollY,
    docH: document.documentElement.scrollHeight,
    bodyOverflow: document.body.style.overflow,
    htmlOverflow: document.documentElement.style.overflow,
  })`);
  console.log(`t+${i + 1}s:`, state);
  const done = JSON.parse(state);
  if (!done.cosmos && done.cinematic) break;
}

// Now try scrolling the film
await evalJs('window.scrollTo(0, window.innerHeight * 2)');
await sleep(800);
console.log('after scroll:', await evalJs(`JSON.stringify({
  scrollY: window.scrollY,
  progress: window.__palace ? window.__palace.progress() : 'no __palace',
  worldOpacity: getComputedStyle(document.querySelector('.world')||document.body).opacity,
})`));

console.log('--- console messages ---');
for (const m of consoleMsgs.slice(0, 40)) console.log(m);
ws.close();
process.exit(0);
