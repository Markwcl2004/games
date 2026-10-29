import {
  T, DIR, DX, DY, FIELD, ENEMY, PLAYER_SPEED, PLAYER_LEVELS, START_LIVES, ENEMIES_PER_STAGE,
  MAX_ENEMIES_ON_FIELD, BONUS_SPAWNS, EXTRA_LIFE_AT, POWERUP_POINTS, SPAWN_ANIM, SPAWN_SHIELD,
  HELMET_TIME, CLOCK_TIME, SHOVEL_TIME, SHOVEL_FLASH, STAGE_CLEAR_DELAY, INTRO_TIME, POWERUPS,
  ENEMY_SPAWNS, PLAYER_SPAWN, BASE_POS, ENEMY_ORDER,
} from './constants.js';
import { Terrain } from './terrain.js';

const BULLET = 4;
const overlap = (ax, ay, aw, bx, by, bw) => ax < bx + bw && bx < ax + aw && ay < by + bw && by < ay + aw;
const perpendicular = (a, b) => (a + b) % 2 === 1;

class Tank {
  constructor(kind, x, y, dir) {
    this.kind = kind;          // 'player' | 'b' | 'f' | 'p' | 'a'
    this.x = x; this.y = y; this.dir = dir;
    this.spawn = SPAWN_ANIM;   // >0 while the spawn star is showing
    this.shield = 0;
    this.hp = kind === 'player' ? 1 : ENEMY[kind].hp;
    this.bonus = false;
    this.level = 0;
    this.anim = 0;
    this.moving = false;
    this.slide = 0;
    this.stuck = 0;
    this.cooldown = 0;
  }
  get alive() { return this.spawn <= 0; }
}

export class Game {
  /**
   * @param {object} o
   * @param {Array} o.stages     stage data list ({ map, enemies })
   * @param {number} o.stage     1-based cumulative stage number (36 = loop 2, stage 1)
   * @param {number} o.lives
   * @param {number} o.level     player firepower level
   * @param {number} o.score
   * @param {function} [o.rng]
   * @param {function} [o.sound]         sound(name)
   * @param {function} [o.onStageStart]  ({ stage, lives, level, score })
   * @param {function} [o.onGameOver]    ({ score, stage })
   */
  constructor(o) {
    this.stages = o.stages;
    this.rng = o.rng || Math.random;
    this.sound = o.sound || (() => {});
    this.onStageStart = o.onStageStart || (() => {});
    this.onGameOver = o.onGameOver || (() => {});
    this.stage = o.stage || 1;
    this.lives = o.lives ?? START_LIVES;
    this.score = o.score || 0;
    this.extraLifeGiven = this.score >= EXTRA_LIFE_AT;
    this.carryLevel = o.level || 0;
    this.frame = 0;
    this.startStage();
  }

  get loop() { return Math.min(3, Math.floor((this.stage - 1) / this.stages.length)); }
  get stageData() { return this.stages[(this.stage - 1) % this.stages.length]; }

  startStage() {
    const d = this.stageData;
    this.terrain = Terrain.fromMap(d.map);
    this.queue = d.enemies;
    this.spawned = 0;
    this.killed = 0;
    this.kills = { b: 0, f: 0, p: 0, a: 0 };
    this.enemies = [];
    this.bullets = [];
    this.effects = [];   // explosions and score popups
    this.powerup = null;
    this.freeze = 0;
    this.shovel = 0;
    this.spawnTimer = 0;
    this.spawnPoint = 0;
    this.baseDestroyed = false;
    this.over = false;
    this.overTimer = 0;
    this.clearTimer = -1;
    this.player = null;
    this.respawnTimer = 0;
    this.spawnPlayer(this.carryLevel);
    this.phase = 'intro';
    this.phaseTimer = INTRO_TIME;
    this.onStageStart({ stage: this.stage, lives: this.lives, level: this.carryLevel, score: this.score });
    this.sound('stageStart');
  }

  spawnPlayer(level) {
    const p = new Tank('player', PLAYER_SPAWN[0], PLAYER_SPAWN[1], DIR.UP);
    p.level = level;
    p.shield = SPAWN_SHIELD;
    this.player = p;
  }

  // ---------------------------------------------------------------- update

  update(input = {}) {
    this.frame++;
    if (this.phase === 'intro') {
      if (--this.phaseTimer <= 0) this.phase = 'play';
      return;
    }
    if (this.phase === 'tally') {
      if (--this.phaseTimer <= 0) this.afterTally();
      return;
    }
    if (this.phase === 'over') {
      if (--this.phaseTimer <= 0) { this.phase = 'done'; this.onGameOver({ score: this.score, stage: this.stage }); }
      return;
    }
    if (this.phase !== 'play') return;

    if (this.freeze > 0) this.freeze--;
    this.updateShovel();
    this.updatePlayer(this.over ? {} : input);
    this.updateEnemies();
    this.updateSpawning();
    this.updateBullets();
    this.updatePowerupPickup();
    this.effects = this.effects.filter(e => ++e.t < e.life);

    if (this.over) {
      if (++this.overTimer > 180) { this.phase = 'tally'; this.phaseTimer = this.tallyLength(); }
    } else if (this.killed >= ENEMIES_PER_STAGE && this.enemies.length === 0) {
      if (this.clearTimer < 0) this.clearTimer = STAGE_CLEAR_DELAY;
      else if (--this.clearTimer <= 0) { this.phase = 'tally'; this.phaseTimer = this.tallyLength(); }
    }
  }

  tallyLength() {
    const n = ENEMY_ORDER.reduce((s, k) => s + this.kills[k], 0);
    return n * 8 + ENEMY_ORDER.length * 30 + 120;
  }

  afterTally() {
    if (this.over) {
      this.phase = 'over';
      this.phaseTimer = 180;
      this.sound('gameOver');
      return;
    }
    this.carryLevel = this.player ? this.player.level : 0;
    this.stage++;
    this.startStage();
  }

  // ---------------------------------------------------------------- movement

  tankHitsTank(t, nx, ny) {
    const all = this.player ? [this.player, ...this.enemies] : this.enemies;
    for (const o of all) {
      if (o === t) continue;
      if (overlap(nx, ny, 16, o.x, o.y, 16) && !overlap(t.x, t.y, 16, o.x, o.y, 16)) return true;
    }
    return false;
  }

  turn(t, dir) {
    if (t.dir === dir) return;
    if (perpendicular(t.dir, dir)) {
      // snap to the 8px grid on the axis we are leaving, like the original
      const sx = DX[dir] === 0 ? Math.round(t.x / 8) * 8 : t.x;
      const sy = DY[dir] === 0 ? Math.round(t.y / 8) * 8 : t.y;
      if (!this.terrain.tankBlocked(sx, sy) && !this.tankHitsTank(t, sx, sy)) { t.x = sx; t.y = sy; }
    }
    t.dir = dir;
  }

  step(t, speed) {
    const free = (x, y) => !this.terrain.tankBlocked(x, y) && !this.tankHitsTank(t, x, y);
    const nx = t.x + DX[t.dir] * speed, ny = t.y + DY[t.dir] * speed;
    if (free(nx, ny)) { t.x = nx; t.y = ny; return true; }
    // close the sub-pixel gap so tanks sit flush against walls
    const ax = DX[t.dir] > 0 ? Math.floor(nx) : DX[t.dir] < 0 ? Math.ceil(nx) : t.x;
    const ay = DY[t.dir] > 0 ? Math.floor(ny) : DY[t.dir] < 0 ? Math.ceil(ny) : t.y;
    if ((ax !== t.x || ay !== t.y) && free(ax, ay)) { t.x = ax; t.y = ay; return true; }
    return false;
  }

  // ---------------------------------------------------------------- player

  updatePlayer(input) {
    if (!this.player) {
      if (!this.over && this.respawnTimer > 0 && --this.respawnTimer === 0) this.spawnPlayer(0);
      return;
    }
    const p = this.player;
    if (!p.alive) { p.spawn--; return; }
    if (p.shield > 0) p.shield--;
    if (p.cooldown > 0) p.cooldown--;

    const dir = input.dir ?? -1;
    const onIce = this.terrain.isIceUnder(p.x, p.y);
    p.moving = false;
    if (dir >= 0) {
      this.turn(p, dir);
      p.moving = this.step(p, PLAYER_SPEED);
      p.slide = onIce ? 16 : 0;
    } else if (p.slide > 0 && onIce) {
      p.moving = this.step(p, PLAYER_SPEED);
      p.slide = p.moving ? p.slide - PLAYER_SPEED : 0;
    } else {
      p.slide = 0;
    }
    if (p.moving || dir >= 0) p.anim++;

    const lv = PLAYER_LEVELS[p.level];
    if (input.fire && p.cooldown === 0 && this.bulletsOf(p) < lv.maxBullets) {
      this.fire(p, lv.bullet, lv.power, true);
      p.cooldown = 6;
    }
  }

  bulletsOf(t) { let n = 0; for (const b of this.bullets) if (b.owner === t) n++; return n; }

  fire(t, speed, power, fromPlayer) {
    this.bullets.push({
      x: t.x + 8 - BULLET / 2 + DX[t.dir] * 6,
      y: t.y + 8 - BULLET / 2 + DY[t.dir] * 6,
      dir: t.dir, speed, power, fromPlayer, owner: t,
    });
    if (fromPlayer) this.sound('fire');
  }

  // ---------------------------------------------------------------- enemies

  updateSpawning() {
    if (this.over || this.spawned >= ENEMIES_PER_STAGE) return;
    if (this.spawnTimer > 0) { this.spawnTimer--; return; }
    if (this.enemies.length >= MAX_ENEMIES_ON_FIELD) return;
    const [x, y] = ENEMY_SPAWNS[this.spawnPoint % ENEMY_SPAWNS.length];
    const all = this.player ? [this.player, ...this.enemies] : this.enemies;
    if (all.some(o => overlap(x, y, 16, o.x, o.y, 16))) { this.spawnPoint++; return; }
    const kind = this.queue[this.spawned] || 'b';
    const e = new Tank(kind, x, y, DIR.DOWN);
    this.spawned++;
    this.spawnPoint++;
    if (BONUS_SPAWNS.includes(this.spawned)) { e.bonus = true; this.powerup = null; }
    this.enemies.push(e);
    this.spawnTimer = Math.max(60, 190 - this.stage % 35 * 4 - this.loop * 15);
  }

  pickDir(e) {
    const r = this.rng();
    if (r < 0.3) return DIR.DOWN;
    if (r < 0.45) return e.x < BASE_POS[0] ? DIR.RIGHT : DIR.LEFT;
    return Math.floor(this.rng() * 4);
  }

  updateEnemies() {
    const speedMul = 1 + 0.1 * this.loop;
    const fireRate = (1 / 60) * (1 + 0.25 * this.loop);
    for (const e of this.enemies) {
      if (!e.alive) { e.spawn--; continue; }
      if (this.freeze > 0) continue;
      e.anim++;
      const moved = this.step(e, ENEMY[e.kind].speed * speedMul);
      if (!moved) e.stuck++; else e.stuck = 0;
      if (e.stuck > 6 || this.rng() < 1 / 120) { this.turn(e, this.pickDir(e)); e.stuck = 0; }
      if (this.bulletsOf(e) === 0 && this.rng() < fireRate) this.fire(e, ENEMY[e.kind].bullet, false, false);
    }
  }

  // ---------------------------------------------------------------- bullets

  updateBullets() {
    for (const b of this.bullets) {
      for (let s = 0; s < b.speed && !b.dead; s++) {
        b.x += DX[b.dir]; b.y += DY[b.dir];
        this.resolveBullet(b);
      }
    }
    this.bullets = this.bullets.filter(b => !b.dead);
  }

  resolveBullet(b) {
    if (b.x < 0 || b.y < 0 || b.x + BULLET > FIELD || b.y + BULLET > FIELD) {
      b.dead = true;
      this.boom(b.x - 6, b.y - 6, 'small');
      if (b.fromPlayer) this.sound('steel');
      return;
    }
    const res = this.terrain.hitBullet(b.x, b.y, BULLET, b.dir, b.power);
    if (res) {
      b.dead = true;
      this.boom(b.x - 6, b.y - 6, 'small');
      if (res.base && !this.baseDestroyed) this.destroyBase();
      else if (b.fromPlayer) this.sound(res.brick || (res.steel && b.power) ? 'brick' : 'steel');
      return;
    }
    for (const o of this.bullets) {
      if (o === b || o.dead || o.fromPlayer === b.fromPlayer) continue;
      if (overlap(b.x, b.y, BULLET, o.x, o.y, BULLET)) { b.dead = o.dead = true; return; }
    }
    if (b.fromPlayer) {
      for (const e of this.enemies) {
        if (e.alive && overlap(b.x, b.y, BULLET, e.x, e.y, 16)) { b.dead = true; this.hitEnemy(e); return; }
      }
    } else if (this.player && this.player.alive && overlap(b.x, b.y, BULLET, this.player.x, this.player.y, 16)) {
      b.dead = true;
      if (this.player.shield <= 0) this.killPlayer();
    }
  }

  hitEnemy(e) {
    if (e.bonus) { e.bonus = false; this.spawnPowerup(); }
    if (--e.hp > 0) { this.sound('armor'); return; }
    this.removeEnemy(e);
    const pts = ENEMY[e.kind].points;
    this.kills[e.kind]++;
    this.addScore(pts);
    this.effects.push({ type: 'text', x: e.x + 8, y: e.y + 8, text: String(pts), t: 0, life: 45 });
    this.sound('enemyDie');
  }

  removeEnemy(e) {
    this.enemies = this.enemies.filter(o => o !== e);
    this.killed++;
    this.boom(e.x - 8, e.y - 8, 'big');
  }

  killPlayer() {
    const p = this.player;
    this.boom(p.x - 8, p.y - 8, 'big');
    this.sound('playerDie');
    this.player = null;
    this.lives--;
    if (this.lives <= 0) this.triggerOver();
    else this.respawnTimer = 60;
  }

  destroyBase() {
    this.baseDestroyed = true;
    this.boom(BASE_POS[0] - 8, BASE_POS[1] - 8, 'big');
    this.sound('baseDie');
    this.triggerOver();
  }

  triggerOver() { if (!this.over) { this.over = true; this.overTimer = 0; } }

  boom(x, y, kind) {
    this.effects.push({ type: kind, x, y, t: 0, life: kind === 'big' ? 24 : 12 });
  }

  addScore(n) {
    this.score += n;
    if (!this.extraLifeGiven && this.score >= EXTRA_LIFE_AT) {
      this.extraLifeGiven = true;
      this.lives++;
      this.sound('life');
    }
  }

  // ---------------------------------------------------------------- power-ups

  spawnPowerup() {
    const kind = POWERUPS[Math.floor(this.rng() * POWERUPS.length)];
    let x, y;
    for (let i = 0; i < 20; i++) {
      x = Math.floor(this.rng() * 25) * 8; y = Math.floor(this.rng() * 25) * 8;
      if (!(y >= 176 && x >= 72 && x <= 120)) break; // keep clear of the eagle
    }
    this.powerup = { kind, x, y, t: 0 };
    this.sound('powerupAppear');
  }

  updatePowerupPickup() {
    const pu = this.powerup, p = this.player;
    if (!pu) return;
    pu.t++;
    if (!p || !p.alive || !overlap(p.x, p.y, 16, pu.x, pu.y, 16)) return;
    this.powerup = null;
    this.addScore(POWERUP_POINTS);
    this.effects.push({ type: 'text', x: pu.x + 8, y: pu.y + 8, text: String(POWERUP_POINTS), t: 0, life: 45 });
    this.applyPowerup(pu.kind);
  }

  applyPowerup(kind) {
    const p = this.player;
    switch (kind) {
      case 'helmet': p.shield = HELMET_TIME; break;
      case 'clock': this.freeze = CLOCK_TIME; break;
      case 'shovel': this.shovel = SHOVEL_TIME; this.terrain.setBaseWall(T.STEEL); break;
      case 'star': p.level = Math.min(3, p.level + 1); break;
      case 'grenade':
        for (const e of [...this.enemies]) if (e.alive) this.removeEnemy(e);
        this.sound('enemyDie');
        break;
      case 'tank': this.lives++; this.sound('life'); return;
    }
    this.sound('powerup');
  }

  updateShovel() {
    if (this.shovel <= 0) return;
    this.shovel--;
    if (this.shovel === 0) { this.terrain.setBaseWall(T.BRICK); return; }
    if (this.shovel <= SHOVEL_FLASH && this.shovel % 16 === 0) {
      this.terrain.setBaseWall((this.shovel / 16) % 2 ? T.BRICK : T.STEEL);
    }
  }

  // ---------------------------------------------------------------- helpers for the HUD

  get enemiesLeft() { return ENEMIES_PER_STAGE - this.spawned; }
  get playerLevel() { return this.player ? this.player.level : 0; }
}
