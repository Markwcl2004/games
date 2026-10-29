// Geometry: the playfield is 13x13 tiles of 16px. Terrain is stored at 4px resolution
// so a bullet can chip away a quarter of a brick tile, as in the original.
export const TILE = 16;
export const CELL = 8;          // one char in the stage map
export const SUB = 4;           // terrain storage resolution
export const FIELD = 208;       // playfield size in px
export const GRID = FIELD / SUB; // 52 terrain cells per side

// Screen layout (NES-like 256x240)
export const SCREEN_W = 256;
export const SCREEN_H = 240;
export const FIELD_X = 16;
export const FIELD_Y = 16;

export const T = { EMPTY: 0, BRICK: 1, STEEL: 2, WATER: 3, TREES: 4, ICE: 5, BASE: 6 };
export const MAP_CHARS = { '.': T.EMPTY, B: T.BRICK, S: T.STEEL, W: T.WATER, T: T.TREES, I: T.ICE, E: T.BASE };

export const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

export const FPS = 60;

// Speeds are px per frame at 60 fps.
export const PLAYER_SPEED = 0.75;
export const BULLET_SLOW = 2;
export const BULLET_FAST = 4;

export const ENEMY = {
  b: { name: 'basic', speed: 0.5, bullet: BULLET_SLOW, hp: 1, points: 100 },
  f: { name: 'fast', speed: 1.0, bullet: BULLET_SLOW, hp: 1, points: 200 },
  p: { name: 'power', speed: 0.5, bullet: BULLET_FAST, hp: 1, points: 300 },
  a: { name: 'armor', speed: 0.5, bullet: BULLET_SLOW, hp: 4, points: 400 },
};
export const ENEMY_ORDER = ['b', 'f', 'p', 'a'];

// Player firepower levels: 0 base, 1 fast bullets, 2 two bullets, 3 breaks steel.
export const PLAYER_LEVELS = [
  { bullet: BULLET_SLOW, maxBullets: 1, power: false },
  { bullet: BULLET_FAST, maxBullets: 1, power: false },
  { bullet: BULLET_FAST, maxBullets: 2, power: false },
  { bullet: BULLET_FAST, maxBullets: 2, power: true },
];

export const START_LIVES = 3;
export const ENEMIES_PER_STAGE = 20;
export const MAX_ENEMIES_ON_FIELD = 4;
export const BONUS_SPAWNS = [4, 11, 18]; // 1-based spawn index of flashing tanks
export const EXTRA_LIFE_AT = 20000;
export const POWERUP_POINTS = 500;

// Durations in frames
export const SPAWN_ANIM = 60;
export const SPAWN_SHIELD = 180;
export const HELMET_TIME = 600;
export const CLOCK_TIME = 600;
export const SHOVEL_TIME = 1200;
export const SHOVEL_FLASH = 180;
export const STAGE_CLEAR_DELAY = 180;
export const INTRO_TIME = 100;

export const POWERUPS = ['helmet', 'clock', 'shovel', 'star', 'grenade', 'tank'];

// Spawn positions (top-left px of the 16px tank box)
export const ENEMY_SPAWNS = [[96, 0], [192, 0], [0, 0]];
export const PLAYER_SPAWN = [64, 192];
export const BASE_POS = [96, 192];

// The 8px cells forming the wall around the eagle: [row, col]
export const BASE_WALL = [[23, 11], [23, 12], [23, 13], [23, 14], [24, 11], [25, 11], [24, 14], [25, 14]];

export const STAGE_COUNT = 35;
