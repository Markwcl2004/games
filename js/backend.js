// Accounts, saves and the leaderboard sit behind this interface so the storage can be swapped
// (browser-only now, Supabase later) without touching the game.
//
//   currentUser()                       -> { nick } | null
//   signUp(nick, password)              -> { ok } | { ok: false, error }
//   signIn(nick, password)              -> { ok } | { ok: false, error }
//   signOut()
//   loadSave()                          -> { stage, lives, level, score, version } | null
//   writeSave(data, expectedVersion)    -> { ok: true, version } | { ok: false, conflict: true, remote }
//                                          (remote.stage is 0 when the other device finished/cleared the run)
//   clearSave(expectedVersion)          -> same shape as writeSave
//   submitScore({ score, stage })       -> { ok }
//   leaderboard()                       -> { rows: [{ nick, score, stage, date }], me: { rank, ... } | null }

export const NICK_MAX = 12;

/** Nicknames: 1-12 chars of CJK, letters, digits, _ and -. Case-insensitive for latin letters. */
export function validateNick(nick) {
  const n = (nick || '').trim();
  if (!n) return '请输入昵称';
  if ([...n].length > NICK_MAX) return `昵称最多 ${NICK_MAX} 个字`;
  if (!/^[\p{Script=Han}A-Za-z0-9_-]+$/u.test(n)) return '昵称只能用中文、英文字母、数字、下划线和减号';
  return null;
}
export function validatePassword(pw) {
  if (!pw || pw.length < 4) return '密码至少 4 位';
  if (pw.length > 64) return '密码太长了';
  return null;
}
export const nickKey = nick => nick.trim().toLowerCase();

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Leaderboard from raw score rows: best score per player, ties broken by earlier date. */
export function rankScores(scores, meKey, limit = 50) {
  const best = new Map();
  for (const s of scores) {
    const k = nickKey(s.nick), cur = best.get(k);
    if (!cur || s.score > cur.score || (s.score === cur.score && s.date < cur.date)) best.set(k, s);
  }
  const all = [...best.values()].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
  const rows = all.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
  const idx = meKey ? all.findIndex(r => nickKey(r.nick) === meKey) : -1;
  return { rows, me: idx >= 0 ? { ...all[idx], rank: idx + 1 } : null };
}

/** Browser-only implementation backed by localStorage. Same contract as the cloud version. */
export class LocalBackend {
  constructor(storage = globalThis.localStorage) {
    this.s = storage;
    this.kind = 'local';
  }
  _get(k, d) { try { const v = this.s.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
  _set(k, v) { this.s.setItem(k, JSON.stringify(v)); }

  currentUser() { return this._get('tb.session', null); }

  async signUp(nick, pw) {
    const err = validateNick(nick) || validatePassword(pw);
    if (err) return { ok: false, error: err };
    const accounts = this._get('tb.accounts', {});
    const key = nickKey(nick);
    if (accounts[key]) return { ok: false, error: '这个昵称已经有人用了' };
    const salt = Math.random().toString(36).slice(2);
    accounts[key] = { nick: nick.trim(), salt, hash: await sha256(salt + pw) };
    this._set('tb.accounts', accounts);
    this._set('tb.session', { nick: nick.trim() });
    return { ok: true };
  }

  async signIn(nick, pw) {
    const a = this._get('tb.accounts', {})[nickKey(nick || '')];
    if (!a || a.hash !== await sha256(a.salt + pw)) return { ok: false, error: '昵称或密码不对' };
    this._set('tb.session', { nick: a.nick });
    return { ok: true };
  }

  async signOut() { this.s.removeItem('tb.session'); }

  _saveKey() { const u = this.currentUser(); return u ? `tb.save.${nickKey(u.nick)}` : null; }

  async loadSave() {
    const k = this._saveKey();
    const v = k && this._get(k, null);
    return v && v.stage ? v : null;
  }

  async _cas(next, expectedVersion) {
    const k = this._saveKey();
    if (!k) return { ok: false, error: '未登录' };
    const cur = this._get(k, { version: 0 });
    if ((cur.version || 0) !== (expectedVersion || 0)) return { ok: false, conflict: true, remote: { ...cur, version: cur.version || 0 } };
    const version = (cur.version || 0) + 1;
    this._set(k, { ...next, version });
    return { ok: true, version };
  }

  async writeSave(data, expectedVersion) {
    const { stage, lives, level, score } = data;
    return this._cas({ stage, lives, level, score, updatedAt: new Date().toISOString() }, expectedVersion);
  }

  async clearSave(expectedVersion) { return this._cas({ stage: 0 }, expectedVersion); }

  /** Read the current save version without loading game data (used before a new game). */
  async saveVersion() { const k = this._saveKey(); return k ? this._get(k, { version: 0 }).version || 0 : 0; }

  async submitScore({ score, stage }) {
    const u = this.currentUser();
    if (!u) return { ok: false, error: '未登录' };
    const list = this._get('tb.scores', []);
    list.push({ nick: u.nick, score, stage, date: new Date().toISOString() });
    this._set('tb.scores', list);
    return { ok: true };
  }

  async leaderboard() {
    const u = this.currentUser();
    return rankScores(this._get('tb.scores', []), u ? nickKey(u.nick) : null);
  }
}
