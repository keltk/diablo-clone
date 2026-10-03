'use strict';
// World: a DATA-DRIVEN table of zones (towns, dungeons, roads), plus the code that builds and enters them.
// Plain script (no modules): shares globals with the other files in js/.
//
// ---------------------------------------------------------------------------------------------
//  HOW TO ADD A ZONE  (no engine code needed):
//   1. Add an entry to WORLD below.
//        town    { type:'town', name, theme, layout:[ascii rows], marks:{char: {npc:'merchant'} | {exit:'zoneId'}} }
//        dungeon { type:'dungeon', name, town:'parentTownId', theme, floors:N, depthStart:D, power, step, mix:[...], boss:{...}, unlock? }
//        road    { type:'road', name, from:'townA', to:'townB', theme, power, mix:[...], unlock? }
//   2. Give the player a way in: put a mark char in a town layout that has {exit:'yourZoneId'}
//      (dungeons) or in BOTH towns for a road (a road's own ends link back to its two towns automatically).
//   3. Optional: add a theme to THEMES (colors) and new enemy types to TYPES (state.js).
//  Unlock rules live on the zone you want to lock:  unlock:{ all:['dun1'] }  or  unlock:{ any:['dun1','dun2'] }
//  (ids of dungeons whose boss must be dead).  Saves store only ids, so new zones never break old saves.
// ---------------------------------------------------------------------------------------------

// ---- themes: floor = 2 checker colours, alt = second floor type (grass...), walls[i] = block palette (+ optional height h) ----
const THEMES = {
  town1: { floor: ['#6b6150', '#645a49'], alt: ['#4a6e3c', '#446638'], tint: null,
    walls: [{ top: '#7a6f60', l: '#403830', r: '#564c40' }, { top: '#9a4a3a', l: '#5e2f26', r: '#7a3a2e', h: 58 },
            { top: '#6ac0f0', l: '#2a6a9a', r: '#3a88c0', h: 14 }, { top: '#3a8a40', l: '#1c4a20', r: '#26602a', h: 48 }] },
  town2: { floor: ['#7d6d4a', '#756542'], alt: ['#5c7a3c', '#567238'], tint: 'rgba(255,200,120,0.05)',
    walls: [{ top: '#8a7a5a', l: '#4a3e2a', r: '#615238' }, { top: '#3a6a8a', l: '#223e52', r: '#2c5068', h: 58 },
            { top: '#6ac0f0', l: '#2a6a9a', r: '#3a88c0', h: 14 }, { top: '#4a7a30', l: '#274418', r: '#355c22', h: 48 }] },
  crypt: { floor: ['#4d453a', '#463f35'], alt: ['#4d453a', '#463f35'], tint: null,
    walls: [{ top: '#5a6078', l: '#2b2f3d', r: '#3c4254' }] },
  ember: { floor: ['#4a2c26', '#42261f'], alt: ['#4a2c26', '#42261f'], tint: 'rgba(120,20,0,0.10)',
    walls: [{ top: '#8a4a30', l: '#3b1a14', r: '#5a291d' }] },
  frost: { floor: ['#3d4d5c', '#364555'], alt: ['#3d4d5c', '#364555'], tint: 'rgba(40,90,160,0.10)',
    walls: [{ top: '#8ab0d0', l: '#3d5870', r: '#587c9a' }] },
  road: { floor: ['#5f5532', '#58502e'], alt: ['#5f5532', '#58502e'], tint: null,
    walls: [{ top: '#2f6a35', l: '#1a3d1f', r: '#24502a', h: 40 }] }
};

// NPCs: name + colours; `kind` picks the panel in townui.js
const NPC_TYPES = {
  merchant: { name: 'Merchant', color: '#d4a017', hat: '#7a4a10', kind: 'merchant' },
  healer:   { name: 'Healer',   color: '#e8e8f4', hat: '#c03a3a', kind: 'healer' },
  trainer:  { name: 'Trainer',  color: '#a04040', hat: '#303030', kind: 'trainer' }
};

// ---- the zone table ----
const WORLD = {
  town1: {
    type: 'town', name: 'Haven', theme: 'town1',
    layout: [
      '##############################',
      '#,,,^,,,,,,,,,,,,,,,,,,,^,,,,#',
      '#,%%%%%%,,^,,,,,,,,,%%%%%%,,,#',
      '#,%%%%%%,,,,,,,,,^,,%%%%%%,,,#',
      '#,%%%%%%,,,,,,,,,,,,%%%%%%,,,#',
      '#,,,M,,,,,,,,,,,,,,,,,H,,,,,^#',
      '#,,,,,,................,,,,,,#',
      '#,,,,,,................,,,,^,#',
      '#^,,,,,................,,,,,,#',
      '#,,,,,,.......FF.............#',
      '#,,,,,,.......FF.............R',
      '#,,,,,,......................#',
      '#^,,,,,................,,,,,,#',
      '#,%%%%%................%%%%,,#',
      '#,%%%%%................%%%%,,#',
      '#,%%%%%%,,,,......,,,,%%%%%,,#',
      '#,,,T,,,,,,,...@..,,,,,,,,,,,#',
      '#,,,,,,,,^,,......,,,,,,,,^,,#',
      '#,,,,,,,,,,,......,,^,,,,,,,,#',
      '#############1###2############'
    ],
    marks: { M: { npc: 'merchant' }, H: { npc: 'healer' }, T: { npc: 'trainer' }, '1': { exit: 'dun1' }, '2': { exit: 'dun2' }, R: { exit: 'road1' } }
  },
  town2: {
    type: 'town', name: 'Fenwick', theme: 'town2',
    layout: [
      '######################',
      '#^,,,,,,,,,,,,,,,,,,^#',
      '#,%%%%%%,^,,,,%%%%%%,#',
      '#,%%%%%%,,,,,,%%%%%%,#',
      '#,%%%%%%,,,,,,%%%%%%,#',
      '#,,,M,,,,,,,,,,,H,,,,#',
      '#,,^,............,,,,#',
      '#,,,,............,,,,#',
      'R................,,,,#',
      '#.........FF.....,^,,#',
      '#,,,,.......@....,,,,#',
      '#,,,,............,,,,#',
      '#^,,,............,,,^#',
      '#,,,,,,,....,,,,,,,,,#',
      '#,,,,,,,....,,,,,,,,,#',
      '##########3###########'
    ],
    marks: { M: { npc: 'merchant' }, H: { npc: 'healer' }, '3': { exit: 'dun3' }, R: { exit: 'road1' } }
  },

  dun1: {
    type: 'dungeon', name: 'Old Crypt', town: 'town1', theme: 'crypt', recLevel: 1,
    floors: 3, depthStart: 1, power: 1.0, step: 0.3,                       // fixed enemy strength: power + step*(floor-1)
    mix: [{ t: 'grunt', w: 55 }, { t: 'brute', w: 30, minFloor: 2 }, { t: 'archer', w: 18 }],
    boss: { name: 'Crypt Lord', T: { name: 'Crypt Lord', color: '#e91e63' } }
  },
  dun2: {
    type: 'dungeon', name: 'Ember Caverns', town: 'town1', theme: 'ember', recLevel: 6,
    floors: 3, depthStart: 4, power: 1.9, step: 0.3,
    mix: [{ t: 'imp', w: 50 }, { t: 'golem', w: 20, minFloor: 2 }, { t: 'cultist', w: 22 }, { t: 'brute', w: 15, minFloor: 2 }],
    boss: { name: 'Magma Tyrant', T: { name: 'Magma Tyrant', color: '#ff6a1a' } },
    unlock: { all: ['dun1'] }
  },
  road1: {
    type: 'road', name: "King's Road", from: 'town1', to: 'town2', theme: 'road', recLevel: 4,
    power: 0.7, step: 0, depth: 2,
    mix: [{ t: 'wolf', w: 60 }, { t: 'grunt', w: 40 }],
    unlock: { any: ['dun1', 'dun2'] }
  },
  dun3: {
    type: 'dungeon', name: 'Frostbound Mines', town: 'town2', theme: 'frost', recLevel: 9,
    floors: 3, depthStart: 7, power: 2.8, step: 0.3,
    mix: [{ t: 'golem', w: 30 }, { t: 'cultist', w: 30 }, { t: 'grunt', w: 25 }, { t: 'imp', w: 20, minFloor: 2 }],
    boss: { name: 'Frost Warden', T: { name: 'Frost Warden', color: '#5ab8ff' } }
  }
};
const START_ZONE = 'town1';
const ZONE_IDS = Object.keys(WORLD);

// ---- run-time world state ----
let zone = null, zoneId = START_ZONE, floor = 1;
let exits = [], npcs = [];
let floorTint = null, wallTint = null;                 // per-tile palette indices (towns), null = palette 0
let world = freshWorld();                               // persistent progress (saved)
function freshWorld() { return { cleared: {}, bestFloor: {}, town: START_ZONE }; }

const isTown = () => zone && zone.type === 'town';
const theme = () => THEMES[(zone && zone.theme)] || THEMES.crypt;
const zoneSeed = (id, fl) => {
  let h = 2166136261; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (seed ^ h ^ Math.imul(fl, 0x9E3779B1)) >>> 0;
};

// ---- unlocking ----
function isUnlocked(id) {
  const z = WORLD[id]; if (!z) return false;
  const u = z.unlock; if (!u) return true;
  if (u.all && !u.all.every(d => world.cleared[d])) return false;
  if (u.any && !u.any.some(d => world.cleared[d])) return false;
  return true;
}
function lockText(id) {
  const u = WORLD[id].unlock || {}, names = (u.all || u.any || []).map(d => WORLD[d].boss ? WORLD[d].boss.name : WORLD[d].name);
  return 'Defeat ' + names.join(u.any ? ' or ' : ' and ');
}

// ---- exits ----
function mkExit(id, tx, ty, o) {
  const e = Object.assign({ id, tx, ty, to: zoneId, floor: 1, arrive: 'up', kind: 'stairs', label: '' }, o);
  exits.push(e); map[ty * MW + tx] = 2; return e;
}
const exitAt = (tx, ty) => exits.find(e => e.tx === tx && e.ty === ty) || null;
function exitLocked(e) { return e.to !== zoneId && !isUnlocked(e.to); }
function exitLabel(e) {
  if (e.label) return e.label;
  const z = WORLD[e.to];
  return z ? z.name : '?';
}
// walkable neighbour of an exit tile, used as the arrival spot
function spawnNear(e) {
  let best = null, bd = 1e9;
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = e.tx + dx, y = e.ty + dy;
    if (!walkable(x, y) || exitAt(x, y)) continue;
    const d = Math.abs(x - MW / 2) + Math.abs(y - MH / 2);
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best ? { x: best.x * TS + TS / 2, y: best.y * TS + TS / 2 } : { x: e.tx * TS + TS / 2, y: e.ty * TS + TS / 2 };
}

// ---- builders ----
function buildTown(z) {
  const rows = z.layout, w = rows[0].length, h = rows.length, ox = (MW - w) >> 1, oy = (MH - h) >> 1;
  map = new Uint8Array(MW * MH).fill(1); floorTint = new Uint8Array(MW * MH); wallTint = new Uint8Array(MW * MH);
  explored = new Uint8Array(MW * MH).fill(1); rooms = [];
  let spawn = { x: (ox + w / 2) * TS, y: (oy + h / 2) * TS };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i], idx = (oy + j) * MW + ox + i, tx = ox + i, ty = oy + j, mark = z.marks && z.marks[ch];
    let tile = 0;
    if (ch === '#') tile = 1;
    else if (ch === '%') { tile = 1; wallTint[idx] = 1; }
    else if (ch === 'F') { tile = 1; wallTint[idx] = 2; }
    else if (ch === '^') { tile = 1; wallTint[idx] = 3; }
    else if (ch === ',') floorTint[idx] = 1;
    map[idx] = tile;
    if (ch === '@') spawn = { x: (tx + 0.5) * TS, y: (ty + 0.5) * TS };
    if (mark && mark.npc) {
      const nt = NPC_TYPES[mark.npc];
      npcs.push({ id: mark.npc, kind: nt.kind, name: mark.name || nt.name, color: nt.color, hat: nt.hat, x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, r: 10 });
      floorTint[idx] = 0;
    }
    if (mark && mark.exit) {
      const tz = WORLD[mark.exit];
      const arrive = !tz ? 'up' : tz.type === 'dungeon' ? 'up' : tz.type === 'road' ? (tz.from === zoneId ? 'west' : 'east') : zoneId;
      mkExit(mark.exit, tx, ty, { to: mark.exit, floor: 1, arrive, kind: tz && tz.type === 'road' ? 'road' : 'dungeon' });
    }
  }
  computeWallVis();
  return spawn;
}

function populate(z, fl, list) {                         // fill rooms (not the first) with this zone's enemy mix
  const power = z.power + (z.step || 0) * (fl - 1);
  const pool = z.mix.filter(m => !m.minFloor || fl >= m.minFloor);
  const total = pool.reduce((a, m) => a + m.w, 0);
  const pickT = () => { let r = rnd() * total; for (const m of pool) { r -= m.w; if (r <= 0) return m.t; } return pool[0].t; };
  for (let i = 1; i < list.length; i++) {
    const r = list[i];
    if (z.type === 'road' && i === list.length - 1) continue;           // keep both road ends calm
    const n = z.type === 'road' ? ri(1, 3) : Math.min(6, ri(1, 2) + (fl >> 1) + (r.stairs ? 1 : 0));
    for (let k = 0; k < n; k++) spawnEnemy(pickT(), r, undefined, undefined, power);
  }
}

function buildDungeonFloor(z, fl) {
  generateDungeon();
  floorTint = wallTint = null;
  const r0 = rooms[0], last = fl >= z.floors;
  mkExit('up', r0.x, r0.y, fl === 1
    ? { to: z.town, floor: 1, arrive: zoneId, kind: 'up', label: 'To ' + WORLD[z.town].name }
    : { to: zoneId, floor: fl - 1, arrive: 'down', kind: 'up', label: 'Stairs up' });
  const dn = mkExit('down', stairs.tx, stairs.ty, last
    ? { to: z.town, floor: 1, arrive: zoneId, kind: 'portal', label: 'Portal to ' + WORLD[z.town].name, needBoss: !!z.boss }
    : { to: zoneId, floor: fl + 1, arrive: 'up', kind: 'stairs', label: 'Stairs down' });
  populate(z, fl, rooms);
  if (z.boss && last) {
    const r = rooms.find(q => q.stairs), power = z.power + (z.step || 0) * (fl - 1);
    const b = spawnEnemy('boss', r, r.cx * TS + TS / 2, r.cy * TS + TS / 2 - TS * 1.5, power, Object.assign({}, TYPES.boss, z.boss.T));
    b.aggro = false;
    msg('A powerful presence lurks near the portal...');
  }
  return { x: r0.cx * TS + TS / 2, y: r0.cy * TS + TS / 2 };
}

function buildRoad(z) {
  map = new Uint8Array(MW * MH).fill(1); explored = new Uint8Array(MW * MH); rooms = [];
  floorTint = wallTint = null;
  const ys = []; let cy = ri(24, 40);
  const carve = (x, y) => { if (x > 0 && x < MW - 1 && y > 1 && y < MH - 2) map[y * MW + x] = 0; };
  for (let x = 3; x <= MW - 4; x++) {
    if (x % 4 === 0) cy = clamp(cy + ri(-2, 2), 14, 50);
    ys[x] = cy;
    for (let dy = -1; dy <= 1; dy++) carve(x, cy + dy);
    if (ys[x - 1] !== undefined && ys[x - 1] !== cy) for (let y = Math.min(cy, ys[x - 1]); y <= Math.max(cy, ys[x - 1]); y++) { carve(x, y); carve(x - 1, y); }
  }
  for (const cx of [8, 22, 34, 47, 57]) {              // clearings
    const w = ri(8, 11), h = ri(6, 8), x = clamp(cx - (w >> 1), 3, MW - 4 - w), y = ys[cx] - (h >> 1);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) carve(i, j);
    rooms.push({ x, y, w, h, cx, cy: ys[cx] });
  }
  const w = mkExit('west', 2, ys[3], { to: z.from, floor: 1, arrive: zoneId, kind: 'road', label: 'To ' + WORLD[z.from].name });
  const e = mkExit('east', MW - 3, ys[MW - 4], { to: z.to, floor: 1, arrive: zoneId, kind: 'road', label: 'To ' + WORLD[z.to].name });
  computeWallVis();
  populate(z, 1, rooms);
  return null;
}

// ---- entering a zone ----
// arrive: id of the exit to appear next to; pos: explicit position (loading a save)
function enterZone(id, fl, opts) {
  opts = opts || {};
  if (!WORLD[id]) id = START_ZONE;
  const z = WORLD[id];
  zone = z; zoneId = id;
  floor = z.type === 'dungeon' ? clamp(fl | 0 || 1, 1, z.floors) : 1;
  depth = z.type === 'dungeon' ? z.depthStart + floor - 1 : z.type === 'road' ? (z.depth || 1) : 0;
  rnd = mulberry32(zoneSeed(id, floor));
  enemies = []; ground = []; projectiles = []; effects = []; pending = []; exits = []; npcs = [];
  let spawn;
  if (z.type === 'town') spawn = buildTown(z);
  else if (z.type === 'dungeon') spawn = buildDungeonFloor(z, floor);
  else spawn = buildRoad(z);
  // lock state of exits (locked ones become solid gates)
  for (const e of exits) { e.locked = exitLocked(e); map[e.ty * MW + e.tx] = e.locked ? 3 : 2; }
  if (opts.arrive) { const ex = exits.find(e => e.id === opts.arrive); if (ex) spawn = spawnNear(ex); }
  else if (!spawn) spawn = spawnNear(exits[0]);
  P.x = spawn.x; P.y = spawn.y; P.path = []; P.target = null; P.pickup = null; P.talk = null; P.whirl = null;
  if (opts.pos && !blocked(opts.pos.x, opts.pos.y, P.r)) { P.x = opts.pos.x; P.y = opts.pos.y; }
  rnd = mulberry32(freshSeed());                        // back to a non-deterministic stream for combat/loot
  mmDirty = true; reveal();
  npcOpen = null;
  if (z.type === 'town') { world.town = id; refreshStock(); }
  else if (z.type === 'dungeon') {
    world.town = z.town;
    world.bestFloor[id] = Math.max(world.bestFloor[id] || 0, floor);
  }
  const tag = z.type === 'dungeon' ? ' - floor ' + floor + '/' + z.floors : z.type === 'town' ? ' (safe)' : '';
  msg(z.name + tag);
  saveBest();
  cam.x = Math.round(projX(P.x, P.y) - W / 2); cam.y = Math.round(projY(P.x, P.y, 0) - H / 2 - 10);
}

// step on an exit tile
function useExit(e) {
  if (exitLocked(e)) { if (time > fullMsgT) { msg('Locked: ' + lockText(e.to)); fullMsgT = time + 2; } return; }
  if (e.needBoss && enemies.some(b => b.boss && !b.dead)) {
    if (time > fullMsgT) { msg('The portal is sealed until the ' + (zone.boss ? zone.boss.name : 'boss') + ' dies.'); fullMsgT = time + 2; }
    return;
  }
  enterZone(e.to, e.floor, { arrive: e.arrive });
  autosave('zone');
}

// a dungeon's boss died
function bossSlain(e) {
  const before = ZONE_IDS.filter(isUnlocked);
  world.cleared[zoneId] = true;
  msg((e.T.name || 'The boss') + ' is slain! The portal is open.');
  addEffect({ type: 'ring', x: e.x, y: e.y, r0: 10, r1: 220, dur: 0.8, color: '255,80,120' });
  const opened = ZONE_IDS.filter(id => isUnlocked(id) && !before.includes(id));
  if (opened.length) msg('New area unlocked: ' + opened.map(id => WORLD[id].name).join(', '));
  autosave('boss');
}

// dying: back to the last town, -10% gold, keep gear and XP
function respawn() {
  const lost = Math.floor(P.gold * 0.1);
  P.gold -= lost;
  P.dead = false; P.deadTime = 0;
  recalc(); P.hp = P.maxhp; P.mp = P.maxmp; P.cds = {}; P.buffs = { warcry: 0, wcArmor: 0, evade: 0, shadow: false }; P.whirl = null;
  invOpen = false; treeOpen = false;
  enterZone(WORLD[world.town] ? world.town : START_ZONE, 1, {});
  if (lost) addText(P.x, P.y, '-' + lost + ' gold', '#f5c518', 16, 1.6);
  msg('You wake up in ' + zone.name + (lost ? ' (lost ' + lost + ' gold)' : ''));
  autosave('zone');
}

function zoneLabel() {                                 // for the HUD
  if (!zone) return '';
  if (zone.type === 'dungeon') return zone.name + '  F' + floor + '/' + zone.floors;
  return zone.name;
}
