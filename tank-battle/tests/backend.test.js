import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalBackend, rankScores, validateNick } from '../js/backend.js';
import { MemoryStorage } from './helpers.js';

test('sign up, sign out, sign in with case-insensitive latin nicknames', async () => {
  const b = new LocalBackend(new MemoryStorage());
  assert.equal((await b.signUp('Tom', 'pass1')).ok, true);
  assert.equal(b.currentUser().nick, 'Tom');
  assert.equal((await b.signUp('tom', 'other')).ok, false);
  await b.signOut();
  assert.equal(b.currentUser(), null);
  assert.equal((await b.signIn('TOM', 'wrong')).ok, false);
  assert.equal((await b.signIn('TOM', 'pass1')).ok, true);
});

test('chinese nicknames are allowed, odd characters are not', () => {
  assert.equal(validateNick('小明'), null);
  assert.equal(validateNick('a b'), '昵称只能用中文、英文字母、数字、下划线和减号');
  assert.ok(validateNick(''));
  assert.ok(validateNick('一二三四五六七八九十一二三'));
});

test('saves use a version check so another device cannot be overwritten silently', async () => {
  const store = new MemoryStorage();
  const a = new LocalBackend(store);
  await a.signUp('amy', 'pass1');
  const r1 = await a.writeSave({ stage: 1, lives: 3, level: 0, score: 0 }, 0);
  assert.deepEqual(r1, { ok: true, version: 1 });
  // device B loads at version 1 and saves stage 2
  const r2 = await a.writeSave({ stage: 2, lives: 3, level: 0, score: 900 }, 1);
  assert.equal(r2.version, 2);
  // device A still thinks it is at version 1
  const r3 = await a.writeSave({ stage: 2, lives: 1, level: 0, score: 300 }, 1);
  assert.equal(r3.ok, false);
  assert.equal(r3.conflict, true);
  assert.equal(r3.remote.stage, 2);
  assert.equal(r3.remote.score, 900);
  assert.equal((await a.loadSave()).score, 900, 'remote save untouched');
});

test('clearing the save leaves no save to continue', async () => {
  const b = new LocalBackend(new MemoryStorage());
  await b.signUp('bob', 'pass1');
  const { version } = await b.writeSave({ stage: 4, lives: 2, level: 1, score: 5000 }, 0);
  assert.equal((await b.clearSave(version)).ok, true);
  assert.equal(await b.loadSave(), null);
});

test('leaderboard keeps each player best run and finds my rank', () => {
  const rows = [
    { nick: 'a', score: 100, stage: 1, date: '2026-10-01' },
    { nick: 'a', score: 900, stage: 3, date: '2026-10-02' },
    { nick: 'b', score: 500, stage: 2, date: '2026-10-01' },
    { nick: 'c', score: 500, stage: 2, date: '2026-09-30' },
  ];
  const { rows: top, me } = rankScores(rows, 'b', 2);
  assert.deepEqual(top.map(r => [r.nick, r.score, r.rank]), [['a', 900, 1], ['c', 500, 2]]);
  assert.deepEqual([me.nick, me.rank], ['b', 3]);
});
