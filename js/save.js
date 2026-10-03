'use strict';
// Save system: versioned localStorage save, validation, autosave rules.
// Plain script (no modules): shares globals with the other files in js/.
//
// What is stored: player stats/inventory/equipment, run seed + depth (the level is regenerated from them),
// player position, explored-map bits and best depth. Enemies/loot on the floor are NOT stored (the floor is rebuilt).

const SAVE_KEY = 'tinydiablo_save';
const SAVE_VERSION = 1;

let autosaveOK = true;      // false after a fresh run started while a save exists, until the player saves manually
let titleOpen = false;      // start screen (Continue / New Game)
let saveCache = null;       // { status: 'none'|'ok'|'corrupt'|'blocked', data? }
let autosaveWarned = false;

// ---- storage access (file:// may block localStorage, so everything is try/catch) ----
function storageGet() { try { return { ok: true, value: localStorage.getItem(SAVE_KEY) }; } catch (e) { return { ok: false, value: null }; } }
function storageSet(s) { try { localStorage.setItem(SAVE_KEY, s); return localStorage.getItem(SAVE_KEY) === s; } catch (e) { return false; } }
function storageRemove() { try { localStorage.removeItem(SAVE_KEY); return true; } catch (e) { return false; } }
function storageAvailable() {
  try { const k = SAVE_KEY + '_probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; }
}

// ---- validation ----
const isNum = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
const isInt = (v, lo, hi) => isNum(v, lo, hi) && Math.floor(v) === v;

function cleanItem(it, slot) {            // returns a sanitized copy or null
  if (!it || typeof it !== 'object') return null;
  if (it.slot !== 'weapon' && it.slot !== 'armor') return null;
  if (slot && it.slot !== slot) return null;
  if (!isInt(it.rar, 0, 2) || typeof it.name !== 'string' || it.name.length > 80) return null;
  for (const k of ['dmg', 'armor', 'hp', 'value']) if (!isNum(it[k], 0, 99999)) return null;
  return { slot: it.slot, rar: it.rar, name: it.name, dmg: it.dmg, armor: it.armor, hp: it.hp, value: it.value };
}

function parseSave(raw) {                 // -> clean save object, or null if missing/invalid/old version
  let o;
  try { o = JSON.parse(raw); } catch (e) { return null; }
  if (!o || typeof o !== 'object' || o.v !== SAVE_VERSION) return null;
  const p = o.player;
  if (!p || typeof p !== 'object') return null;
  if (!isInt(o.seed, 0, 4294967295) || !isInt(o.depth, 1, 9999) || !isNum(o.savedAt, 0, 1e15)) return null;
  if (!isInt(p.level, 1, 999) || !isNum(p.xp, 0, 1e9) || !isNum(p.hp, 0, 1e6) || !isNum(p.mp, 0, 1e6)) return null;
  if (!isInt(p.gold, 0, 1e9) || !p.potions || !isInt(p.potions.hp, 0, 999) || !isInt(p.potions.mp, 0, 999)) return null;
  if (!Array.isArray(p.inv) || p.inv.length > INV_SIZE) return null;
  const inv = p.inv.map(it => cleanItem(it)); if (inv.some(x => !x)) return null;
  const weapon = p.weapon == null ? null : cleanItem(p.weapon, 'weapon'); if (p.weapon != null && !weapon) return null;
  const armor = p.armor == null ? null : cleanItem(p.armor, 'armor'); if (p.armor != null && !armor) return null;
  const pos = isNum(p.x, 0, MW * TS) && isNum(p.y, 0, MH * TS) ? { x: p.x, y: p.y } : null;   // position is optional
  const exp = typeof o.explored === 'string' && o.explored.length === MW * MH / 4 && /^[0-9a-f]+$/.test(o.explored) ? o.explored : null;
  return {
    savedAt: o.savedAt, seed: o.seed, depth: o.depth, best: isInt(o.best, 1, 9999) ? o.best : o.depth,
    kills: isInt(o.kills, 0, 1e9) ? o.kills : 0, explored: exp,
    player: { level: p.level, xp: p.xp, hp: p.hp, mp: p.mp, gold: p.gold, potions: { hp: p.potions.hp, mp: p.potions.mp },
              inv, weapon, armor, pos }
  };
}

// refresh the cached view of what is in storage (call whenever the menu opens or a save changes)
function refreshSave() {
  const r = storageGet();
  if (!r.ok) { saveCache = { status: 'blocked' }; return saveCache; }
  if (r.value == null) { saveCache = { status: 'none' }; return saveCache; }
  const data = parseSave(r.value);
  saveCache = data ? { status: 'ok', data } : { status: 'corrupt' };
  return saveCache;
}
function saveExists() { return (saveCache || refreshSave()).status === 'ok'; }

// ---- explored map <-> hex ----
function packExplored() {
  let s = '';
  for (let i = 0; i < MW * MH; i += 4) s += ((explored[i] ? 8 : 0) | (explored[i + 1] ? 4 : 0) | (explored[i + 2] ? 2 : 0) | (explored[i + 3] ? 1 : 0)).toString(16);
  return s;
}
function unpackExplored(hex) {
  for (let i = 0; i < hex.length; i++) {
    const n = parseInt(hex[i], 16);
    for (let b = 0; b < 4; b++) if (n & (8 >> b)) explored[i * 4 + b] = 1;
  }
  mmDirty = true;
}

// ---- save / load / delete ----
// returns { ok:true } or { ok:false, error:'...' }
function saveGame() {
  if (!P || P.dead) return { ok: false, error: 'Nothing to save' };
  if (!storageAvailable()) return { ok: false, error: 'Saving is unavailable (browser storage is blocked)' };
  const data = {
    v: SAVE_VERSION, savedAt: Date.now(), seed, depth, best: bestDepth, kills,
    player: { level: P.level, xp: P.xp, hp: P.hp, mp: P.mp, gold: P.gold, potions: P.potions, inv: P.inv,
              weapon: P.weapon, armor: P.armor, x: P.x, y: P.y },
    explored: packExplored()
  };
  if (!storageSet(JSON.stringify(data))) return { ok: false, error: 'Saving failed (storage full or blocked)' };
  autosaveOK = true;
  refreshSave();
  return { ok: true };
}

function autosave(reason) {
  if (titleOpen || !P || P.dead || !autosaveOK) return;
  const r = saveGame();
  if (r.ok) { if (reason === 'stairs') msg('Game autosaved'); }
  else if (!autosaveWarned) { autosaveWarned = true; msg(r.error); }
}

function loadGame() {                     // -> true on success
  const c = refreshSave();
  if (c.status !== 'ok') return false;
  const d = c.data;
  seed = d.seed; depth = d.depth; kills = d.kills;
  bestDepth = Math.max(bestDepth, d.best);
  P = makePlayer();
  const s = d.player;
  P.level = s.level; P.xp = s.xp; P.gold = s.gold; P.potions = s.potions;
  P.inv = s.inv; P.weapon = s.weapon; P.armor = s.armor;
  recalc(); P.hp = clamp(s.hp, 1, P.maxhp); P.mp = clamp(s.mp, 0, P.maxmp);
  messages = []; texts = [];
  invOpen = false; hintT = 6;
  buildLevel();                           // regenerates the same floor from (seed, depth)
  if (s.pos && !blocked(s.pos.x, s.pos.y, P.r)) { P.x = s.pos.x; P.y = s.pos.y; }
  if (d.explored) unpackExplored(d.explored);
  reveal();
  autosaveOK = true;
  return true;
}

function deleteSave() {
  const ok = storageRemove();
  refreshSave();
  return ok;
}

// autosave when the tab is hidden / closed
// (only if the run has some progress, so just opening and closing the page never creates a save)
const hasProgress = () => depth > 1 || P.level > 1 || P.xp > 0 || P.gold > 0 || kills > 0;
document.addEventListener('visibilitychange', () => { if (document.hidden && P && hasProgress()) autosave('hidden'); });
window.addEventListener('pagehide', () => { if (P && hasProgress()) autosave('pagehide'); });
