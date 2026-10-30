// All artwork is generated here as small pixel canvases. Nothing is taken from the original game.

const cache = new Map();
const canvas = (w, h) => {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return c;
};

/** Paint a grid of chars using a palette map; '.' is transparent. */
function paint(rows, pal) {
  const h = rows.length, w = rows[0].length, c = canvas(w, h), g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const col = pal[rows[y][x]];
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  return c;
}

/** Rotate a char grid clockwise `times` quarter turns. */
function rotate(rows, times) {
  let r = rows;
  for (let k = 0; k < times; k++) {
    const h = r.length, w = r[0].length, out = [];
    for (let x = 0; x < w; x++) { let s = ''; for (let y = h - 1; y >= 0; y--) s += r[y][x]; out.push(s); }
    r = out;
  }
  return r;
}

/** Add a 1px outline of `ch` around every non-transparent pixel. */
function outline(rows, ch = 'k') {
  const h = rows.length, w = rows[0].length, out = rows.map(r => r.split(''));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rows[y][x] !== '.') continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => rows[y + dy]?.[x + dx] && rows[y + dy][x + dx] !== '.');
    if (n) out[y][x] = ch;
  }
  return out.map(r => r.join(''));
}

// ------------------------------------------------------------------ tanks

/**
 * Build a 16x16 tank facing up. Shades: 1 dark, 2 mid, 3 light.
 * `shape` varies by tank type so each reads differently at a glance.
 */
function tankGrid(shape, frame) {
  const g = Array.from({ length: 16 }, () => Array(16).fill('.'));
  const set = (x, y, v) => { if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = v; };
  const box = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };
  const s = shape;

  // treads
  for (const tx of [s.treadL, 15 - s.treadL - s.treadW + 1]) {
    for (let y = s.top; y <= 15; y++) {
      for (let x = tx; x < tx + s.treadW; x++) {
        const edge = x === tx || x === tx + s.treadW - 1;
        set(x, y, (y + frame) % 2 === 0 ? (edge ? '1' : '3') : (edge ? '1' : '2'));
      }
    }
    box(tx, s.top, tx + s.treadW - 1, s.top, '1');
    box(tx, 15, tx + s.treadW - 1, 15, '1');
  }
  // hull
  box(s.hullL, s.hullTop, 15 - s.hullL, s.hullBot, '2');
  box(s.hullL, s.hullTop, 15 - s.hullL, s.hullTop, '3');
  box(s.hullL, s.hullTop, s.hullL, s.hullBot, '3');
  box(s.hullL, s.hullBot, 15 - s.hullL, s.hullBot, '1');
  box(15 - s.hullL, s.hullTop, 15 - s.hullL, s.hullBot, '1');
  // turret
  const [tx0, ty0, tx1, ty1] = s.turret;
  box(tx0 + 1, ty0, tx1 - 1, ty1, '3');
  box(tx0, ty0 + 1, tx1, ty1 - 1, '3');
  box(tx0 + 1, ty0 + 1, tx1 - 1, ty1 - 1, '2');
  set(tx0 + 2, ty0 + 2, '3');
  box(tx1 - 1, ty0 + 2, tx1 - 1, ty1 - 1, '1');
  // barrel(s)
  for (const bx of s.barrels) { box(bx, s.barrelTop, bx + s.barrelW - 1, ty0 + 1, '3'); box(bx + s.barrelW - 1, s.barrelTop, bx + s.barrelW - 1, ty0, '1'); }
  return g.map(r => r.join(''));
}

const SHAPES = {
  // player shapes by firepower level
  p0: { treadL: 1, treadW: 3, top: 3, hullL: 4, hullTop: 5, hullBot: 13, turret: [5, 6, 10, 11], barrels: [7], barrelW: 2, barrelTop: 1 },
  p1: { treadL: 1, treadW: 3, top: 3, hullL: 4, hullTop: 5, hullBot: 13, turret: [5, 6, 10, 11], barrels: [7], barrelW: 2, barrelTop: 0 },
  p2: { treadL: 1, treadW: 3, top: 3, hullL: 4, hullTop: 4, hullBot: 13, turret: [4, 5, 11, 12], barrels: [7], barrelW: 2, barrelTop: 0 },
  p3: { treadL: 0, treadW: 4, top: 2, hullL: 4, hullTop: 4, hullBot: 14, turret: [4, 5, 11, 12], barrels: [6], barrelW: 4, barrelTop: 0 },
  // enemies
  b: { treadL: 1, treadW: 3, top: 4, hullL: 4, hullTop: 6, hullBot: 13, turret: [5, 7, 10, 12], barrels: [7], barrelW: 2, barrelTop: 2 },
  f: { treadL: 2, treadW: 2, top: 2, hullL: 4, hullTop: 4, hullBot: 14, turret: [5, 7, 10, 11], barrels: [7], barrelW: 2, barrelTop: 0 },
  p: { treadL: 1, treadW: 3, top: 3, hullL: 4, hullTop: 5, hullBot: 13, turret: [4, 6, 11, 11], barrels: [5, 9], barrelW: 2, barrelTop: 1 },
  a: { treadL: 0, treadW: 4, top: 2, hullL: 3, hullTop: 4, hullBot: 14, turret: [4, 5, 11, 12], barrels: [7], barrelW: 2, barrelTop: 0 },
};

export const PALETTES = {
  player: { 1: '#6b3d00', 2: '#e39a1c', 3: '#ffe08a' },
  enemy: { 1: '#2c2c2c', 2: '#a0a0a0', 3: '#f2f2f2' },
  red: { 1: '#5a0a0a', 2: '#d23a2a', 3: '#ffb0a0' },
  armor4: { 1: '#0d3d14', 2: '#3aa84a', 3: '#b8f2b0' },
  armor3: { 1: '#4a3a00', 2: '#c8a020', 3: '#fff0a0' },
  armor2: { 1: '#3a2a4a', 2: '#9a78c8', 3: '#e8d8ff' },
};

export function tankSprite(shapeKey, paletteKey, dir, frame) {
  const key = `t:${shapeKey}:${paletteKey}:${dir}:${frame}`;
  if (!cache.has(key)) cache.set(key, paint(rotate(tankGrid(SHAPES[shapeKey], frame), dir), PALETTES[paletteKey]));
  return cache.get(key);
}

/** 7x7 icon used in the HUD enemy counter. */
export function miniTank() {
  const key = 'mini';
  if (!cache.has(key)) cache.set(key, paint([
    '...1...',
    '.1.1.1.',
    '1111111',
    '1.111.1',
    '1111111',
    '1.111.1',
    '1.....1',
  ], { 1: '#222' }));
  return cache.get(key);
}

// ------------------------------------------------------------------ terrain textures (8x8)

const TEX = {
  brick: [
    'bbbbbbbm',
    'bbbbbbbm',
    'dddddddm',
    'mmmmmmmm',
    'bbbmbbbb',
    'bbbmbbbb',
    'dddmdddd',
    'mmmmmmmm',
  ],
  steel: [
    'wwwwwwwd',
    'wssssssd',
    'wssssssd',
    'wsswwssd',
    'wsswwssd',
    'wssssssd',
    'wssssssd',
    'dddddddd',
  ],
  water0: [
    'bbbbbbbb',
    'bblbbbbb',
    'blblbbbb',
    'bbbbbbbb',
    'bbbbbbbb',
    'bbbbbblb',
    'bbbbblbl',
    'bbbbbbbb',
  ],
  trees: [
    'dlgd.dlg',
    'lggdldgg',
    'ggd.lggd',
    'd.dlggd.',
    'dlggd.dl',
    'lggdlgdg',
    'gd.lggd.',
    '.dlgd.dl',
  ],
};
TEX.water1 = TEX.water0.map(r => r.slice(2) + r.slice(0, 2));
TEX.ice = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => (x === y ? 'w' : x + y === 7 ? 'd' : 's')).join(''));

const TEX_PAL = {
  brick: { b: '#a8541c', d: '#6e2e08', m: '#7c7c7c' },
  steel: { w: '#ffffff', s: '#b4b4b4', d: '#5c5c5c' },
  water0: { b: '#2a46d8', l: '#9ab2ff' },
  water1: { b: '#2a46d8', l: '#9ab2ff' },
  trees: { d: '#0c4a0c', g: '#2e9a1c', l: '#84d02a' },
  ice: { w: '#ffffff', s: '#c8d4dc', d: '#8ca0ac' },
};

export function texture(name) {
  const key = `x:${name}`;
  if (!cache.has(key)) cache.set(key, paint(TEX[name], TEX_PAL[name]));
  return cache.get(key);
}

// ------------------------------------------------------------------ eagle base (16x16)

const EAGLE = [
  '................',
  'g.g..........g.g',
  'g.gg...ww...gg.g',
  'gg.gg.wwww.gg.gg',
  'ggg.gg.ww.gg.ggg',
  '.ggg.gwwwwg.ggg.',
  '..ggg.gwwg.ggg..',
  '...gggg..gggg...',
  '....ggg..ggg....',
  '.....gggggg.....',
  '......gggg......',
  '.....gg..gg.....',
  '....ggg..ggg....',
  '...gggggggggg...',
  '..gggggggggggg..',
  '................',
];
const RUBBLE = [
  '................',
  '..w.............',
  '..wrrrrr........',
  '..wrrrrrrr......',
  '..wrrrrr........',
  '..w.............',
  '..w.....g.......',
  '..w...g.gg..g...',
  '..w..ggggg.gg...',
  '..w.gggdggggg...',
  '..wgggdggdgggg..',
  '.ggggdgggggdggg.',
  '.gggggdggdggggg.',
  'ggdgggggggggdggg',
  'gggggdggggggggdg',
  '................',
];
export function eagle(destroyed) {
  const key = `e:${destroyed}`;
  if (!cache.has(key)) cache.set(key, destroyed
    ? paint(RUBBLE, { w: '#e0e0e0', r: '#d23a2a', g: '#6c6c6c', d: '#3a3a3a' })
    : paint(outline(EAGLE, 'k'), { g: '#9a9a9a', w: '#f0f0f0', k: '#3a3a3a' }));
  return cache.get(key);
}

// ------------------------------------------------------------------ power-ups (16x16)

const PU = {
  helmet: [
    '............',
    '....gggg....',
    '..gwwwwwwg..',
    '.gwwggwwwwg.',
    '.gwgwwwwwwg.',
    'gwwwwwwwwwwg',
    'gwwwwwwwwwwg',
    'gggggggggggg',
    'gw........wg',
    'g..........g',
    '............',
    '............',
  ],
  clock: [
    '...gggggg...',
    '..gwwwwwwg..',
    '.gwwwkwwwwg.',
    'gwwwwkwwwwwg',
    'gwwwwkwwwwwg',
    'gwwwwkkkkwwg',
    'gwwwwwwwwwwg',
    'gwwwwwwwwwwg',
    '.gwwwwwwwwg.',
    '..gwwwwwwg..',
    '...gggggg...',
    '............',
  ],
  shovel: [
    '..........yy',
    '.........yy.',
    '........yy..',
    '.......yy...',
    '......yy....',
    '..gg.yy.....',
    '.gwwgy......',
    'gwwwwg......',
    'gwwwwwg.....',
    'gwwwwwg.....',
    '.gwwwg......',
    '..ggg.......',
  ],
  star: [
    '.....yy.....',
    '.....yy.....',
    '....yyyy....',
    'yyyyyyyyyyyy',
    '.yyyyyyyyyy.',
    '..yyyyyyyy..',
    '...yyyyyy...',
    '..yyyyyyyy..',
    '..yyy..yyy..',
    '.yyy....yyy.',
    '.yy......yy.',
    '............',
  ],
  grenade: [
    '......rr....',
    '.....r..r...',
    '....gggr....',
    '...gwwwg....',
    '..gwgwgwg...',
    '.gwwwwwwwg..',
    '.gwgwgwgwg..',
    '.gwwwwwwwg..',
    '.gwgwgwgwg..',
    '..gwwwwwg...',
    '...ggggg....',
    '............',
  ],
  tank: [
    '.....yy.....',
    '.....yy.....',
    '.yy..yy..yy.',
    '.yyyyyyyyyy.',
    '.yyyggggyyy.',
    '.yyyg..gyyy.',
    '.yyyg..gyyy.',
    '.yyyggggyyy.',
    '.yyyyyyyyyy.',
    '.yy......yy.',
    '............',
    '............',
  ],
};

export function powerupSprite(kind) {
  const key = `p:${kind}`;
  if (!cache.has(key)) {
    const pad = r => '..' + r + '..';
    const blank = '.'.repeat(16);
    const rows = [blank, blank, ...PU[kind].map(pad), blank, blank];
    cache.set(key, paint(outline(rows, 'k'), { w: '#ffffff', g: '#8a8a8a', k: '#101010', y: '#ffd23a', r: '#e04030' }));
  }
  return cache.get(key);
}

// ------------------------------------------------------------------ effects

function hash(x, y, s) { let h = x * 374761393 + y * 668265263 + s * 2147483647; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/** Explosion frame: size 16 (small) or 32 (big); frame 0..2. */
export function explosion(size, frame) {
  const key = `b:${size}:${frame}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size), g = c.getContext('2d');
  const r = size / 2 * [0.45, 0.8, 1][frame];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / r + (hash(x, y, frame) - 0.5) * 0.35;
    if (d > 1) continue;
    g.fillStyle = d < 0.35 ? '#ffffff' : d < 0.6 ? '#ffd86a' : d < 0.8 ? '#e0402a' : '#6a1a8a';
    g.fillRect(x, y, 1, 1);
  }
  cache.set(key, c);
  return c;
}

/** Spawn sparkle, frame 0..3 */
export function sparkle(frame) {
  const key = `s:${frame}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(16, 16), g = c.getContext('2d');
  const r = [2, 4, 6, 7][frame];
  g.fillStyle = '#ffffff';
  for (let i = -r; i <= r; i++) { g.fillRect(8 + i - 0.5 | 0, 7, 1, 2); g.fillRect(7, 8 + i - 0.5 | 0, 2, 1); }
  g.fillStyle = '#a8c8ff';
  const q = Math.max(1, r >> 1);
  for (let i = -q; i <= q; i++) { g.fillRect(8 + i, 8 + i, 1, 1); g.fillRect(8 + i, 8 - i, 1, 1); }
  cache.set(key, c);
  return c;
}

/** Shield ring around the player, frame 0..1 */
export function shield(frame) {
  const key = `h:${frame}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(16, 16), g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 16; i++) {
    if ((i + frame) % 3 === 0) continue;
    g.fillRect(i, 0, 1, 1); g.fillRect(15 - i, 15, 1, 1); g.fillRect(0, 15 - i, 1, 1); g.fillRect(15, i, 1, 1);
  }
  for (let i = 0; i < 6; i++) { const a = (i / 6 + frame * 0.08) * Math.PI * 2; g.fillRect(Math.round(8 + Math.cos(a) * 6) - 0.5 | 0, Math.round(8 + Math.sin(a) * 6) - 0.5 | 0, 1, 1); }
  cache.set(key, c);
  return c;
}

export function bulletSprite(dir) {
  const key = `u:${dir}`;
  if (!cache.has(key)) cache.set(key, paint(rotate(['.ww.', 'wwww', 'wwww', 'wwww'], dir), { w: '#e8e8e8' }));
  return cache.get(key);
}
