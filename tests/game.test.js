import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game.js';
import { STAGES } from '../js/stages.js';
import { DIR, INTRO_TIME, SPAWN_ANIM, ENEMY } from '../js/constants.js';
import { blankMap } from './helpers.js';

const stage = (edits, enemies = 'b'.repeat(20)) => [{ map: blankMap(edits), enemies }];
const run = (g, n, input = {}) => { for (let i = 0; i < n; i++) g.update(input); };
const ready = g => run(g, INTRO_TIME + SPAWN_ANIM + 2);

test('every bundled stage loads', () => {
  for (let i = 1; i <= STAGES.length; i++) {
    const g = new Game({ stages: STAGES, stage: i, rng: () => 0.99 });
    assert.equal(g.phase, 'intro');
  }
});

test('stage start reports the values to save', () => {
  const saves = [];
  new Game({ stages: stage(), stage: 3, lives: 2, level: 1, score: 1500, onStageStart: s => saves.push(s) });
  assert.deepEqual(saves, [{ stage: 3, lives: 2, level: 1, score: 1500 }]);
});

test('player moves, is blocked by brick and snaps to the 8px grid when turning', () => {
  const g = new Game({ stages: stage([[22, 8, 'B'], [22, 9, 'B']]), rng: () => 0.99 });
  ready(g);
  const p = g.player;
  assert.equal(p.y, 192);
  run(g, 40, { dir: DIR.UP });
  assert.equal(p.y, 184, 'stops flush under the brick at y=176..184');
  p.x = 67; // off-grid
  run(g, 1, { dir: DIR.RIGHT });
  run(g, 1, { dir: DIR.UP });
  assert.equal(p.x % 8, 0);
});

test('player bullet destroys an enemy and scores its points', () => {
  const g = new Game({ stages: stage(), rng: () => 0.99 });
  ready(g);
  // put one live enemy straight above the player
  const e = g.enemies[0];
  e.x = 64; e.y = 120; e.spawn = 0; e.dir = DIR.DOWN;
  g.freeze = 1000;
  run(g, 60, { fire: true });
  assert.equal(g.kills.b, 1);
  assert.equal(g.score, ENEMY.b.points);
});

test('armor tanks need four hits', () => {
  const g = new Game({ stages: stage([], 'a'.repeat(20)), rng: () => 0.99 });
  ready(g);
  const e = g.enemies[0];
  for (let i = 0; i < 3; i++) g.hitEnemy(e);
  assert.equal(g.enemies.includes(e), true);
  g.hitEnemy(e);
  assert.equal(g.enemies.includes(e), false);
  assert.equal(g.kills.a, 1);
});

test('losing all lives ends the game and reports the score', () => {
  let over = null;
  const g = new Game({ stages: stage(), lives: 1, rng: () => 0.99, onGameOver: r => { over = r; } });
  ready(g);
  g.player.shield = 0;
  g.killPlayer();
  assert.equal(g.over, true);
  run(g, 2000);
  assert.equal(g.phase, 'done');
  assert.deepEqual(over, { score: 0, stage: 1 });
});

test('a bullet into the eagle ends the game', () => {
  const g = new Game({ stages: stage([[23, 12, '.'], [23, 13, '.']]), rng: () => 0.99 });
  ready(g);
  g.bullets.push({ x: 102, y: 180, dir: DIR.DOWN, speed: 2, power: false, fromPlayer: false, owner: null });
  run(g, 20);
  assert.equal(g.baseDestroyed, true);
  assert.equal(g.over, true);
});

test('killing all 20 enemies advances to the next stage and carries score and level', () => {
  const two = [...stage(), ...stage()];
  const saves = [];
  const g = new Game({ stages: two, rng: () => 0.99, onStageStart: s => saves.push(s) });
  ready(g);
  g.player.level = 2;
  for (let n = 0; n < 8000 && g.stage === 1; n++) {
    for (const e of [...g.enemies]) if (e.alive) g.hitEnemy(e);
    g.update({});
  }
  assert.equal(g.stage, 2);
  assert.equal(g.kills.b, 0, 'kills reset for the new stage');
  assert.equal(saves[1].score, 2000);
  assert.equal(saves[1].level, 2);
});

test('star power-up raises firepower, grenade clears enemies without points', () => {
  const g = new Game({ stages: stage(), rng: () => 0.99 });
  ready(g);
  g.applyPowerup('star');
  assert.equal(g.player.level, 1);
  const before = g.score;
  const n = g.enemies.filter(e => e.alive).length;
  g.applyPowerup('grenade');
  assert.equal(g.enemies.filter(e => e.alive).length, 0);
  assert.equal(g.killed, n);
  assert.equal(g.score, before);
});

test('an extra life is awarded once at 20000 points', () => {
  const g = new Game({ stages: stage(), rng: () => 0.99, score: 19900 });
  const lives = g.lives;
  g.addScore(200);
  g.addScore(20000);
  assert.equal(g.lives, lives + 1);
});

test('stage numbers past 35 loop back with tougher enemies', () => {
  const g = new Game({ stages: STAGES, stage: 36, rng: () => 0.99 });
  assert.equal(g.stageData, STAGES[0]);
  assert.equal(g.loop, 1);
});
