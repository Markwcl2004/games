import { GRID, SUB, FIELD, T, MAP_CHARS, DX, DY, BASE_WALL } from './constants.js';

const blocksTank = t => t === T.BRICK || t === T.STEEL || t === T.WATER || t === T.BASE;
const blocksBullet = t => t === T.BRICK || t === T.STEEL || t === T.BASE;

export class Terrain {
  constructor() {
    this.g = new Uint8Array(GRID * GRID);
    this.version = 0; // bumped on every change so the renderer can cache
  }

  static fromMap(rows) {
    const t = new Terrain();
    for (let r = 0; r < 26; r++) {
      for (let c = 0; c < 26; c++) {
        const v = MAP_CHARS[rows[r][c]] ?? T.EMPTY;
        t.fill8(r, c, v);
      }
    }
    return t;
  }

  fill8(r, c, v) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) this.g[(r * 2 + dy) * GRID + c * 2 + dx] = v;
    this.version++;
  }

  get(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) return -1;
    return this.g[cy * GRID + cx];
  }

  set(cx, cy, v) {
    if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) return;
    this.g[cy * GRID + cx] = v;
    this.version++;
  }

  /** Cells overlapped by a px rectangle [x, x+w) x [y, y+h). */
  *cells(x, y, w, h) {
    const x0 = Math.floor(x / SUB), y0 = Math.floor(y / SUB);
    const x1 = Math.ceil((x + w) / SUB) - 1, y1 = Math.ceil((y + h) / SUB) - 1;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) yield [cx, cy];
  }

  /** True if a 16px tank box at (x, y) hits a wall or leaves the field. */
  tankBlocked(x, y, size = 16) {
    if (x < 0 || y < 0 || x + size > FIELD || y + size > FIELD) return true;
    for (const [cx, cy] of this.cells(x, y, size, size)) if (blocksTank(this.get(cx, cy))) return true;
    return false;
  }

  isIceUnder(x, y, size = 16) {
    let ice = 0, n = 0;
    for (const [cx, cy] of this.cells(x, y, size, size)) { n++; if (this.get(cx, cy) === T.ICE) ice++; }
    return ice * 2 >= n;
  }

  /**
   * Resolve a bullet box against terrain.
   * Returns null if nothing was hit, otherwise { base, steel, brick } flags for what was struck.
   * Bricks (and steel when `power`) in a 16px-wide strip across the bullet path are removed,
   * 4px deep for normal bullets and 8px deep for power bullets.
   */
  hitBullet(bx, by, size, dir, power) {
    let hit = false;
    for (const [cx, cy] of this.cells(bx, by, size, size)) {
      if (blocksBullet(this.get(cx, cy))) { hit = true; break; }
    }
    if (!hit) return null;

    const res = { base: false, steel: false, brick: false };
    for (const [cx, cy] of this.cells(bx, by, size, size)) if (this.get(cx, cy) === T.BASE) res.base = true;

    const vertical = DX[dir] === 0;
    const cxMid = bx + size / 2, cyMid = by + size / 2;
    // the leading row/column of cells the bullet touches
    let lead;
    if (vertical) lead = DY[dir] < 0 ? Math.floor(by / SUB) : Math.floor((by + size - 0.001) / SUB);
    else lead = DX[dir] < 0 ? Math.floor(bx / SUB) : Math.floor((bx + size - 0.001) / SUB);
    const across0 = Math.round(((vertical ? cxMid : cyMid) - 8) / SUB);
    const depth = power ? 2 : 1;
    const step = vertical ? DY[dir] : DX[dir];

    // Walk forward from the lead until the first row that actually has something solid in the strip.
    for (let k = 0, row = lead, found = 0; k < 4 && found < depth; k++, row += step) {
      let any = false;
      for (let a = across0; a < across0 + 4; a++) {
        const [cx, cy] = vertical ? [a, row] : [row, a];
        const v = this.get(cx, cy);
        if (v === T.BRICK) { this.set(cx, cy, T.EMPTY); res.brick = true; any = true; }
        else if (v === T.STEEL) {
          res.steel = true; any = true;
          if (power) this.clearSteel8(cx, cy);
        } else if (v === T.BASE) { any = true; }
      }
      if (any) found++;
      else if (found === 0) continue;
      else break;
    }
    return res;
  }

  clearSteel8(cx, cy) {
    const r = Math.floor(cy / 2), c = Math.floor(cx / 2);
    this.fill8(r, c, T.EMPTY);
  }

  /** Set the eagle's surrounding wall to brick or steel (shovel power-up). */
  setBaseWall(kind) {
    for (const [r, c] of BASE_WALL) this.fill8(r, c, kind);
  }
}
