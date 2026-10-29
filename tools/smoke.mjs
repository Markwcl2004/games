// Headless smoke test: drives the game in Chrome over the DevTools protocol and saves screenshots.
// Usage: node tools/smoke.mjs <url> <outdir>   (serve the repo first: npm run serve)
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] || 'http://127.0.0.1:8642/';
const out = process.argv[3] || 'smoke-out';
mkdirSync(out, { recursive: true });
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'tb-'))}`, '--window-size=1000,800', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let ws, id = 0;
const pending = new Map(), problems = [];
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
      ws = new WebSocket(t.webSocketDebuggerUrl);
      await new Promise(r => ws.addEventListener('open', r, { once: true }));
      ws.addEventListener('message', ev => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') problems.push('EXCEPTION ' + JSON.stringify(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
        if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) problems.push(`console.${m.params.type} ` + m.params.args.map(a => a.value ?? a.description).join(' '));
        if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') problems.push('LOG ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
      });
      return;
    } catch { await sleep(200); }
  }
  throw new Error('chrome did not start');
}
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, name), Buffer.from(r.result.data, 'base64')); };
const KEYS = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Space: 32, KeyP: 80 };
const key = (type, code) => send('Input.dispatchKeyEvent', { type, code, key: code === 'Space' ? ' ' : code, windowsVirtualKeyCode: KEYS[code] });
async function hold(code, ms) { await key('keyDown', code); await sleep(ms); await key('keyUp', code); }
const state = () => evaluate(`(() => { const g = window.__tb?.game; return g && { phase: g.phase, stage: g.stage, score: g.score, lives: g.lives, killed: g.killed, enemies: g.enemies.length, player: g.player && [Math.round(g.player.x), Math.round(g.player.y), g.player.level] }; })()`);

try {
  await connect();
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.navigate', { url: url + '#play-debug' });
  await sleep(2600);
  await shot('1-start.png');
  console.log('after intro', await state());
  await hold('ArrowUp', 900);
  for (let i = 0; i < 6; i++) { await hold('Space', 120); await sleep(150); }
  await shot('2-moved-fired.png');
  console.log('after moving/firing', await state());
  // play randomly for a while
  const codes = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  for (let i = 0; i < 40; i++) { const c = codes[i % 4 === 0 ? 0 : Math.floor(Math.random() * 4)]; await key('keyDown', 'Space'); await hold(c, 300); await key('keyUp', 'Space'); }
  await shot('3-after-random-play.png');
  console.log('after random play', await state());
  // pause
  await hold('KeyP', 50); await sleep(300);
  await shot('4-paused.png');
  // phone landscape with touch
  await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true, screenOrientation: { type: 'landscapePrimary', angle: 90 } });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(300);
  await send('Page.navigate', { url: url + '#play-debug' });
  await sleep(2800);
  await shot('5-phone.png');
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(300);
  await send('Page.navigate', { url });
  await sleep(1200);
  await shot('6-phone-menu.png');
  console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'no console errors or exceptions');
} finally {
  chrome.kill();
  process.exit(0);
}
