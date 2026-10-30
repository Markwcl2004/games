import { Game } from './game.js';
import { STAGES } from './stages.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { LocalBackend } from './backend.js';
import { START_LIVES, SCREEN_W, SCREEN_H } from './constants.js';

const ADMIN_NAME = '站长';
const STEP = 1000 / 60;

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

const backend = new LocalBackend();
const sound = new Sound();
const input = new Input();
input.bindTouch($('pad'), $('knob'), $('fire'));
const renderer = new Renderer($('screen'));
const isTouch = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', isTouch);
$('admin-name').textContent = ADMIN_NAME;
$(isTouch ? 'help-keys' : 'help-touch').hidden = true;

let game = null;
let guest = true;
let paused = false;
let saveVersion = 0;
let menuSave = null;
let lastResult = '';

// ------------------------------------------------------------------ screens

const OVERLAYS = ['menu', 'auth', 'board', 'paused'];
function show(id) {
  for (const o of OVERLAYS) $(o).hidden = o !== id;
  const playing = !!game && !id;
  document.body.classList.toggle('playing', !!game);
  $('touch-ui').hidden = !(isTouch && game && !id);
  input.enabled = playing;
  if (!playing) input.reset();
}

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/** In-page dialog. buttons: [{ label, primary?, run? }] */
function ask(msg, buttons) {
  $('dialog-msg').textContent = msg;
  const box = $('dialog-btns');
  box.innerHTML = '';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.type = 'button'; el.textContent = b.label;
    if (b.primary) el.className = 'primary';
    el.onclick = () => { $('dialog').hidden = true; b.run?.(); };
    box.append(el);
  }
  $('dialog').hidden = false;
  box.firstChild?.focus();
}

async function showMenu() {
  game = null; paused = false;
  show('menu');
  const user = backend.currentUser();
  menuSave = user ? await backend.loadSave() : null;
  saveVersion = user ? (menuSave?.version ?? await backend.saveVersion()) : 0;
  $('who').textContent = user ? `已登录：${user.nick}` : '当前是游客：可以玩，但不存档、不上排行榜';
  $('btn-continue').hidden = !menuSave;
  if (menuSave) $('btn-continue').textContent = `继续游戏 · 第 ${menuSave.stage} 关`;
  $('btn-new').textContent = user ? '新游戏' : '游客试玩';
  $('btn-auth').textContent = user ? `退出登录（${user.nick}）` : '登录 / 注册';
  $('btn-sound').textContent = `声音：${sound.enabled ? '开' : '关'}`;
  $('result').hidden = !lastResult;
  $('result').textContent = lastResult;
  (menuSave ? $('btn-continue') : $('btn-new')).focus({ preventScroll: true });
}

// ------------------------------------------------------------------ game flow

function startGame(from, asGuest) {
  sound.unlock();
  guest = asGuest;
  lastResult = '';
  paused = false;
  game = new Game({
    stages: STAGES,
    stage: from.stage, lives: from.lives, level: from.level, score: from.score,
    sound: n => sound.play(n),
    onStageStart: s => saveAtStageStart(s),
    onGameOver: r => queueMicrotask(() => finishGame(r)),
  });
  document.activeElement?.blur();
  show(null);
  if (asGuest) toast('游客模式：不存档、不上排行榜');
}

const FRESH = { stage: 1, lives: START_LIVES, level: 0, score: 0 };

async function saveAtStageStart(s) {
  if (guest) return;
  try {
    const res = await backend.writeSave(s, saveVersion);
    if (res.ok) saveVersion = res.version;
    else if (res.conflict) onConflict(res.remote, s);
    else toast('存档失败，下一关开始时会再试');
  } catch {
    toast('存档失败，下一关开始时会再试');
  }
}

function onConflict(remote, local) {
  paused = true;
  const msg = remote.stage
    ? `存档已在另一台设备上更新：那边在第 ${remote.stage} 关，${remote.score} 分。`
    : '存档已在另一台设备上更新：那边已经结束了一局。';
  const buttons = [];
  if (remote.stage) buttons.push({ label: `载入那份存档（第 ${remote.stage} 关）`, primary: true, run: () => { saveVersion = remote.version; startGame(remote, false); } });
  buttons.push({ label: '继续本局，覆盖那份存档', primary: !remote.stage, run: () => { saveVersion = remote.version; saveAtStageStart(local); paused = false; } });
  ask(msg, buttons);
}

async function finishGame({ score, stage }) {
  lastResult = `本局 ${score} 分，打到第 ${stage} 关`;
  if (!guest) {
    await submitWithRetry({ score, stage });
    try { await backend.clearSave(saveVersion); } catch {}
  }
  showMenu();
}

// Scores that failed to upload wait in localStorage and are retried on the next visit.
const PENDING = 'tb.pendingScores';
const readPending = () => { try { return JSON.parse(localStorage.getItem(PENDING)) || []; } catch { return []; } };
const writePending = list => { try { localStorage.setItem(PENDING, JSON.stringify(list)); } catch {} };

async function submitWithRetry(entry) {
  try {
    const r = await backend.submitScore(entry);
    if (r.ok) return;
  } catch {}
  const u = backend.currentUser();
  writePending([...readPending(), { ...entry, nick: u?.nick }]);
  toast('分数上传失败，下次打开时会自动补传');
}

async function flushPending() {
  const u = backend.currentUser();
  if (!u) return;
  const keep = [];
  for (const p of readPending()) {
    if (p.nick !== u.nick) { keep.push(p); continue; }
    try { const r = await backend.submitScore(p); if (!r.ok) keep.push(p); } catch { keep.push(p); }
  }
  writePending(keep);
}

function togglePause(force) {
  if (!game || game.phase === 'done') return;
  paused = force ?? !paused;
  sound.play('pause');
  $('quit-note').textContent = guest ? '游客模式不会保存进度' : `回到菜单后，下次从第 ${game.stage} 关开头继续`;
  show(paused ? 'paused' : null);
}

// ------------------------------------------------------------------ menu actions

$('btn-continue').onclick = () => menuSave && startGame(menuSave, false);
$('btn-new').onclick = () => {
  const user = backend.currentUser();
  if (!user) return startGame(FRESH, true);
  if (menuSave) {
    ask(`新游戏会覆盖第 ${menuSave.stage} 关的存档，确定吗？`, [
      { label: '覆盖，开新游戏', primary: true, run: () => startGame(FRESH, false) },
      { label: '算了' },
    ]);
  } else startGame(FRESH, false);
};
$('btn-board').onclick = showBoard;
$('btn-auth').onclick = async () => {
  if (backend.currentUser()) { await backend.signOut(); lastResult = ''; showMenu(); }
  else { setAuthMode('login'); show('auth'); $('nick').focus(); }
};
$('btn-sound').onclick = () => { sound.setEnabled(!sound.enabled); sound.unlock(); $('btn-sound').textContent = `声音：${sound.enabled ? '开' : '关'}`; };
$('btn-resume').onclick = () => togglePause(false);
$('btn-quit').onclick = () => { lastResult = ''; showMenu(); };
$('pause-btn').onclick = () => togglePause(true);
for (const b of document.querySelectorAll('.back')) b.onclick = () => showMenu();

// ------------------------------------------------------------------ auth

let authMode = 'login';
function setAuthMode(m) {
  authMode = m;
  $('auth-title').textContent = m === 'login' ? '登录' : '注册';
  $('auth-submit').textContent = m === 'login' ? '登录' : '注册并登录';
  $('auth-switch').textContent = m === 'login' ? '没有账号？注册一个' : '已有账号？去登录';
  $('pw').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('auth-err').hidden = true;
}
$('auth-switch').onclick = () => setAuthMode(authMode === 'login' ? 'register' : 'login');
$('auth-form').onsubmit = async e => {
  e.preventDefault();
  const nick = $('nick').value.trim(), pw = $('pw').value;
  $('auth-submit').disabled = true;
  try {
    const r = authMode === 'login' ? await backend.signIn(nick, pw) : await backend.signUp(nick, pw);
    if (!r.ok) { $('auth-err').textContent = r.error; $('auth-err').hidden = false; return; }
    $('pw').value = '';
    toast(`欢迎，${backend.currentUser().nick}`);
    await flushPending();
    showMenu();
  } catch {
    $('auth-err').textContent = '网络出错了，稍后再试'; $('auth-err').hidden = false;
  } finally {
    $('auth-submit').disabled = false;
  }
};

// ------------------------------------------------------------------ leaderboard

async function showBoard() {
  show('board');
  const body = $('board-rows');
  body.innerHTML = '<tr><td colspan="5">加载中…</td></tr>';
  try {
    const { rows, me } = await backend.leaderboard();
    const user = backend.currentUser();
    body.innerHTML = rows.length ? rows.map(r => `<tr class="${user && r.nick === user.nick ? 'me' : ''} ${r.rank === 1 ? 'top1' : ''}">
      <td>${r.rank}</td><td>${esc(r.nick)}</td><td>${r.score}</td><td>${r.stage}</td><td>${r.date.slice(5, 10)}</td></tr>`).join('')
      : '<tr><td colspan="5">还没有人上榜，去打一局吧</td></tr>';
    const meVisible = me && rows.some(r => r.rank === me.rank);
    $('board-me').hidden = !me || meVisible;
    if (me && !meVisible) $('board-me').textContent = `你的名次：第 ${me.rank} 名，${me.score} 分`;
  } catch {
    body.innerHTML = '<tr><td colspan="5">排行榜加载失败，稍后再试</td></tr>';
  }
}

// ------------------------------------------------------------------ layout

function fit() {
  const c = $('screen');
  let w = innerWidth, h = innerHeight;
  // leave room for the stick and fire button: at the sides in landscape, below in portrait
  if (isTouch) { if (w > h) w -= 2 * 150; else h -= 200; }
  let s = Math.min(w / SCREEN_W, h / SCREEN_H);
  if (s >= 2) s = Math.floor(s);
  s = Math.max(1, s);
  c.style.width = `${Math.floor(SCREEN_W * s)}px`;
  c.style.height = `${Math.floor(SCREEN_H * s)}px`;
}
addEventListener('resize', fit);
// iOS can report the old size on the first event after a rotation, so measure again a bit later.
addEventListener('orientationchange', () => { fit(); setTimeout(fit, 300); });
window.visualViewport?.addEventListener('resize', fit);
fit();

document.addEventListener('visibilitychange', () => { if (document.hidden && game && !paused) togglePause(true); });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// ------------------------------------------------------------------ loop

// A frozen stage-1 board drawn behind the menu.
const backdrop = new Game({ stages: STAGES, stage: 1 });
backdrop.phase = 'play';

let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(100, now - last);
  last = now;
  if (game && game.phase !== 'done') {
    if (input.consumePause() && $('dialog').hidden) togglePause();
    if (!paused) {
      acc += dt;
      while (acc >= STEP && game && game.phase !== 'done') {
        game.update({ dir: input.dir, fire: input.fire });
        acc -= STEP;
      }
    } else acc = 0;
    if (game) renderer.draw(game, { paused });
  } else {
    renderer.draw(backdrop);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

flushPending();
showMenu().then(() => { if (location.hash.includes('play')) startGame(FRESH, true); });
// Test hook for tools/smoke.mjs: open with #debug to expose the running game.
if (location.hash.includes('debug')) window.__tb = { get game() { return game; }, backend };
