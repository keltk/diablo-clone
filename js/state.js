'use strict';
// Shared game state globals and enemy type table.
// Plain script (no modules): shares globals with the other files in js/.

// ===================================================================
//  GAME STATE
// ===================================================================
let map, explored, wallVis, rooms, stairs;
let P, enemies, ground, projectiles, effects, texts, messages;
let depth, kills, paused = false, invOpen = false, treeOpen = false, classSelectOpen = false, npcOpen = null, time = 0, hintT = 0;
let mmCanvas, mmDirty = true;
let bestDepth = 1;
const cam = { x: 0, y: 0 };
const mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, mode: 'move', repath: 0, touch: false };
let lastPointerType = 'mouse';
const touchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
let fullMsgT = 0;

try { bestDepth = parseInt(localStorage.getItem('tinydiablo_best') || '1', 10) || 1; } catch (e) { /* ignore */ }
function saveBest() {
  if (depth > bestDepth) {
    bestDepth = depth;
    try { localStorage.setItem('tinydiablo_best', String(bestDepth)); } catch (e) { /* ignore */ }
  }
}

// ===================================================================
//  ENEMY TYPES
// ===================================================================
const TYPES = {
  grunt:  { name: 'Grunt',  color: '#c0392b', r: 9,  sz: 20, hp: 30,  dmg: 6,  spd: 110, aggro: 250, cd: 0.9, xp: 10 },
  brute:  { name: 'Brute',  color: '#8e44ad', r: 12, sz: 28, hp: 100, dmg: 15, spd: 55,  aggro: 220, cd: 1.4, xp: 26 },
  archer: { name: 'Archer', color: '#27ae60', r: 9,  sz: 20, hp: 24,  dmg: 8,  spd: 80,  aggro: 340, cd: 1.7, xp: 18, ranged: true },
  wolf:   { name: 'Wolf',   color: '#9a9484', r: 8,  sz: 18, hp: 18,  dmg: 5,  spd: 135, aggro: 240, cd: 0.9, xp: 6 },
  imp:    { name: 'Imp',    color: '#ff7a2a', r: 8,  sz: 18, hp: 22,  dmg: 7,  spd: 150, aggro: 260, cd: 0.8, xp: 14 },
  golem:  { name: 'Golem',  color: '#7a7f8c', r: 13, sz: 32, hp: 170, dmg: 16, spd: 45,  aggro: 200, cd: 1.5, xp: 34 },
  cultist:{ name: 'Cultist', color: '#3a7ad0', r: 9, sz: 20, hp: 26,  dmg: 9,  spd: 80,  aggro: 340, cd: 1.6, xp: 20, ranged: true },
  boss:   { name: 'Overlord', color: '#e91e63', r: 14, sz: 46, hp: 600, dmg: 20, spd: 80, aggro: 600, cd: 1.1, xp: 220, boss: true }
};
