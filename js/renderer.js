import { T, GRID, SUB, FIELD, FIELD_X, FIELD_Y, SCREEN_W, SCREEN_H, ENEMY, ENEMY_ORDER, BASE_POS } from './constants.js';
import { tankSprite, miniTank, texture, eagle, powerupSprite, explosion, sparkle, shield, bulletSprite } from './sprites.js';
import { text } from './font.js';

const BG = '#6b6b6b';
const TEX_OF = { [T.BRICK]: 'brick', [T.STEEL]: 'steel', [T.ICE]: 'ice' };

function layer(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.ground = layer(FIELD, FIELD);
    this.trees = layer(FIELD, FIELD);
    this.cacheKey = '';
  }

  /** Re-render terrain layers only when terrain or water animation changed. */
  paintTerrain(terrain, frame) {
    const waterFrame = (frame >> 5) & 1;
    const key = `${terrain.version}:${waterFrame}:${terrain === this.lastTerrain}`;
    if (key === this.cacheKey && terrain === this.lastTerrain) return;
    this.cacheKey = key; this.lastTerrain = terrain;
    const gg = this.ground.getContext('2d'), tg = this.trees.getContext('2d');
    gg.clearRect(0, 0, FIELD, FIELD); tg.clearRect(0, 0, FIELD, FIELD);
    const water = texture(waterFrame ? 'water1' : 'water0'), trees = texture('trees');
    for (let cy = 0; cy < GRID; cy++) for (let cx = 0; cx < GRID; cx++) {
      const v = terrain.get(cx, cy);
      if (v === T.EMPTY || v === T.BASE) continue;
      const sx = (cx * SUB) % 8, sy = (cy * SUB) % 8, dx = cx * SUB, dy = cy * SUB;
      if (v === T.TREES) tg.drawImage(trees, sx, sy, SUB, SUB, dx, dy, SUB, SUB);
      else gg.drawImage(v === T.WATER ? water : texture(TEX_OF[v]), sx, sy, SUB, SUB, dx, dy, SUB, SUB);
    }
  }

  draw(game, { paused = false } = {}) {
    const g = this.g;
    g.imageSmoothingEnabled = false;
    g.fillStyle = BG;
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);

    if (game.phase === 'intro') return this.drawIntro(game);
    if (game.phase === 'tally') return this.drawTally(game);
    if (game.phase === 'over' || game.phase === 'done') return this.drawGameOver();

    g.fillStyle = '#000';
    g.fillRect(FIELD_X, FIELD_Y, FIELD, FIELD);
    this.paintTerrain(game.terrain, game.frame);

    g.save();
    g.translate(FIELD_X, FIELD_Y);
    g.drawImage(this.ground, 0, 0);
    g.drawImage(eagle(game.baseDestroyed), BASE_POS[0], BASE_POS[1]);

    const f = game.frame;
    const tanks = game.player ? [game.player, ...game.enemies] : game.enemies;
    for (const t of tanks) {
      if (!t.alive) { const k = (t.spawn >> 2) % 6; g.drawImage(sparkle(k < 4 ? k : 6 - k), t.x | 0, t.y | 0); continue; }
      const frame = (t.anim >> 2) & 1;
      let shape, pal;
      if (t.kind === 'player') { shape = `p${t.level}`; pal = 'player'; }
      else {
        shape = t.kind;
        pal = t.bonus && (f >> 3) & 1 ? 'red' : t.kind === 'a' ? ['enemy', 'enemy', 'armor2', 'armor3', 'armor4'][t.hp] : 'enemy';
      }
      g.drawImage(tankSprite(shape, pal, t.dir, frame), Math.round(t.x), Math.round(t.y));
      if (t.shield > 0) g.drawImage(shield((f >> 1) & 1), Math.round(t.x), Math.round(t.y));
    }
    for (const b of game.bullets) g.drawImage(bulletSprite(b.dir), Math.round(b.x), Math.round(b.y));
    g.drawImage(this.trees, 0, 0);

    for (const e of game.effects) {
      if (e.type === 'small') g.drawImage(explosion(16, Math.min(2, e.t >> 2)), e.x | 0, e.y | 0);
      else if (e.type === 'big') {
        const k = Math.min(2, e.t >> 3);
        const img = explosion(k === 2 ? 32 : 16, k === 2 ? 2 : k);
        const off = k === 2 ? 0 : 8;
        g.drawImage(img, (e.x | 0) + off, (e.y | 0) + off);
      } else if (e.type === 'text' && e.t > 12) text(g, e.text, e.x, e.y - 2, '#fff', 1, 'center');
    }
    if (game.powerup && (game.powerup.t >> 3) % 4 !== 3) g.drawImage(powerupSprite(game.powerup.kind), game.powerup.x, game.powerup.y);

    if (game.over) {
      const y = Math.max(FIELD / 2 - 12, FIELD - game.overTimer * 1.2);
      text(g, 'GAME', FIELD / 2, y, '#e0402a', 2, 'center');
      text(g, 'OVER', FIELD / 2, y + 12, '#e0402a', 2, 'center');
    }
    g.restore();

    this.drawHud(game);
    if (paused && (Date.now() >> 9) & 1) text(g, 'PAUSE', FIELD_X + FIELD / 2, FIELD_Y + FIELD / 2 - 5, '#e0402a', 2, 'center');
  }

  drawHud(game) {
    const g = this.g;
    text(g, `SCORE ${String(game.score).padStart(6, '0')}`, FIELD_X, 6, '#000');
    text(g, `STAGE ${game.stage}`, FIELD_X + FIELD, 6, '#000', 1, 'right');
    const mini = miniTank();
    for (let i = 0; i < game.enemiesLeft; i++) g.drawImage(mini, 232 + (i % 2) * 9, 24 + Math.floor(i / 2) * 9);
    text(g, 'IP', 232, 128, '#000');
    g.drawImage(tankSprite('p0', 'player', 0, 0), 230, 136, 8, 8);
    text(g, String(Math.max(0, game.lives)), 242, 138, '#000');
    // stage flag
    g.fillStyle = '#000'; g.fillRect(233, 172, 1, 14);
    g.fillStyle = '#e39a1c'; g.fillRect(234, 172, 9, 6);
    text(g, String(game.stage), 247, 190, '#000', 1, 'right');
  }

  drawIntro(game) {
    text(this.g, `STAGE ${game.stage}`, SCREEN_W / 2, SCREEN_H / 2 - 5, '#000', 2, 'center');
  }

  drawTally(game) {
    const g = this.g;
    g.fillStyle = '#000'; g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    text(g, `STAGE ${game.stage}`, SCREEN_W / 2, 24, '#fff', 2, 'center');
    text(g, 'SCORE', 70, 50, '#e0402a', 1, 'center');
    text(g, String(game.score), 70, 60, '#ffd23a', 1, 'center');
    // rows count up one kill every 8 frames, with a 30 frame pause per row
    let t = game.tallyLength() - game.phaseTimer, total = 0;
    ENEMY_ORDER.forEach((k, i) => {
      const y = 84 + i * 24;
      const n = game.kills[k];
      const shown = t < 0 ? 0 : Math.min(n, Math.floor(t / 8));
      t -= n * 8 + 30;
      total += shown;
      text(g, `${shown * ENEMY[k].points}`, 96, y + 4, '#fff', 1, 'right');
      text(g, 'PTS', 104, y + 4, '#fff');
      text(g, String(shown), 136, y + 4, '#fff', 1, 'right');
      text(g, '>', 142, y + 4, '#fff');
      g.drawImage(tankSprite(k, 'enemy', 0, 0), 152, y);
    });
    g.fillStyle = '#fff'; g.fillRect(96, 180, 80, 1);
    text(g, 'TOTAL', 96, 188, '#fff', 1, 'right');
    text(g, String(total), 136, 188, '#fff', 1, 'right');
  }

  drawGameOver() {
    const g = this.g;
    g.fillStyle = '#000'; g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    text(g, 'GAME', SCREEN_W / 2, 88, '#e0402a', 6, 'center');
    text(g, 'OVER', SCREEN_W / 2, 124, '#e0402a', 6, 'center');
  }
}
