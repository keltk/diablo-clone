'use strict';
// Constants, canvas, small helpers, seeded RNG, isometric projection.
// Plain script (no modules): shares globals with the other files in js/.

// ===================================================================
//  CONSTANTS & HELPERS
// ===================================================================
const W = 1280, H = 720;          // canvas size
const TS = 32;                    // tile size (px)
const MW = 64, MH = 64;           // map size (tiles)
const DT = 1 / 60;                // fixed timestep
const HW = 32, HH = 16;           // isometric half tile: 2:1 diamond (64 x 32 px)
const WALL_H = 44;                // wall block height (screen px)
const MELEE_RANGE = 26;           // melee reach beyond body radii
const INV_SIZE = 16;
const RARITY_COLOR = ['#e8e8e8', '#4a8cff', '#ffd93b'];
const RARITY_NAME = ['Common', 'Magic', 'Rare'];

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let seed = 0, rnd = Math.random;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = arr => arr[Math.floor(rnd() * arr.length)];


// ===================================================================
//  ISOMETRIC PROJECTION  (world = pixels on a flat grid, TS per tile)
//  screen X = (u - v) * HW,  screen Y = (u + v) * HH - z,  with u = x/TS, v = y/TS
// ===================================================================
function projX(x, y) { return (x - y) / TS * HW; }
function projY(x, y, z) { return (x + y) / TS * HH - (z || 0); }
function toWorld(sx, sy) {            // inverse, for the ground plane (z = 0)
  const X = (sx + cam.x) / HW, Y = (sy + cam.y) / HH;
  return { x: (X + Y) / 2 * TS, y: (Y - X) / 2 * TS };
}
function updateMouseWorld() { const w = toWorld(mouse.x, mouse.y); mouse.wx = w.x; mouse.wy = w.y; }
