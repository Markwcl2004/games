import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Terrain } from '../js/terrain.js';
import { T, DIR } from '../js/constants.js';
import { blankMap } from './helpers.js';

test('map chars expand to 4px cells', () => {
  const t = Terrain.fromMap(blankMap([[0, 0, 'B'], [0, 1, 'S']]));
  assert.equal(t.get(0, 0), T.BRICK);
  assert.equal(t.get(1, 1), T.BRICK);
  assert.equal(t.get(2, 0), T.STEEL);
  assert.equal(t.get(4, 0), T.EMPTY);
  assert.equal(t.get(24, 48), T.BASE);
});

test('tanks are blocked by brick, steel, water and the field edge but not trees or ice', () => {
  const t = Terrain.fromMap(blankMap([[4, 4, 'B'], [4, 8, 'W'], [4, 12, 'T'], [4, 16, 'I']]));
  assert.equal(t.tankBlocked(32, 24), true);   // overlaps brick at 32..40, 32..40
  assert.equal(t.tankBlocked(64, 24), true);   // water
  assert.equal(t.tankBlocked(96, 24), false);  // trees
  assert.equal(t.tankBlocked(128, 24), false); // ice
  assert.equal(t.tankBlocked(-1, 0), true);
  assert.equal(t.tankBlocked(193, 0), true);
  assert.equal(t.tankBlocked(192, 0), false);
});

test('a bullet chips one 4px row off a brick and leaves the rest', () => {
  // brick tile covering px 64..80 x 64..80 (map cells r8-9, c8-9)
  const t = Terrain.fromMap(blankMap([[8, 8, 'B'], [8, 9, 'B'], [9, 8, 'B'], [9, 9, 'B']]));
  // bullet travelling up, its top edge just entered the bottom row of the brick (y=79)
  const res = t.hitBullet(70, 79, 4, DIR.UP, false);
  assert.ok(res && res.brick);
  for (let cx = 16; cx < 20; cx++) assert.equal(t.get(cx, 19), T.EMPTY, `cell ${cx},19 cleared`);
  for (let cx = 16; cx < 20; cx++) assert.equal(t.get(cx, 18), T.BRICK, `cell ${cx},18 intact`);
});

test('normal bullets bounce off steel, power bullets remove it', () => {
  const t = Terrain.fromMap(blankMap([[8, 8, 'S']]));
  let res = t.hitBullet(66, 71, 4, DIR.UP, false);
  assert.ok(res && res.steel);
  assert.equal(t.get(16, 17), T.STEEL);
  res = t.hitBullet(66, 71, 4, DIR.UP, true);
  assert.ok(res && res.steel);
  assert.equal(t.get(16, 17), T.EMPTY);
  assert.equal(t.get(17, 16), T.EMPTY);
});

test('bullets pass over water, trees and ice', () => {
  const t = Terrain.fromMap(blankMap([[8, 8, 'W'], [8, 10, 'T'], [8, 12, 'I']]));
  assert.equal(t.hitBullet(66, 66, 4, DIR.UP, false), null);
  assert.equal(t.hitBullet(82, 66, 4, DIR.UP, false), null);
  assert.equal(t.hitBullet(98, 66, 4, DIR.UP, false), null);
});

test('hitting the eagle is reported', () => {
  const t = Terrain.fromMap(blankMap());
  const res = t.hitBullet(102, 192, 4, DIR.DOWN, false);
  assert.ok(res && res.base);
});

test('shovel turns the base wall to steel and back', () => {
  const t = Terrain.fromMap(blankMap());
  t.setBaseWall(T.STEEL);
  assert.equal(t.get(22, 46), T.STEEL);
  t.setBaseWall(T.BRICK);
  assert.equal(t.get(22, 46), T.BRICK);
});
