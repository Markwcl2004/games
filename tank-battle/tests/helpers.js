/** A blank 26x26 stage map with the eagle and its brick wall, plus optional overrides. */
export function blankMap(edits = []) {
  const rows = Array.from({ length: 26 }, () => Array(26).fill('.'));
  for (const [r, c] of [[23, 11], [23, 12], [23, 13], [23, 14], [24, 11], [25, 11], [24, 14], [25, 14]]) rows[r][c] = 'B';
  for (const [r, c] of [[24, 12], [24, 13], [25, 12], [25, 13]]) rows[r][c] = 'E';
  for (const [r, c, ch] of edits) rows[r][c] = ch;
  return rows.map(r => r.join(''));
}

export function seq(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

export class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
