'use strict';
// Level setup, effects, combat, and the per-frame update of player/enemies/projectiles.
// Plain script (no modules): shares globals with the other files in js/.

// ===================================================================
//  LEVEL / RUN SETUP
// ===================================================================
const freshSeed = () => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
// Level layout + population is a pure function of (run seed, depth), so a save only needs those two numbers.
const levelSeed = () => (seed ^ Math.imul(depth, 0x9E3779B1)) >>> 0;

function makePlayer(clsId) {
  const c = CLASSES[clsId] || CLASSES.warrior;
  const p = {
    x: 0, y: 0, r: 10, speed: c.spd, baseSpeed: c.spd, cls: c.id,
    hp: 100, maxhp: 100, mp: 50, maxmp: 50, level: 1, xp: 0, gold: 0,
    flash: 0, atkCd: 0, potCd: 0, path: [], target: null, pickup: null, repathT: 0,
    potions: { hp: 2, mp: 1 }, inv: [], face: 0, dead: false, swing: 0,
    weapon: { slot: 'weapon', rar: 0, name: 'Rusty Sword', dmg: 3, armor: 0, hp: 0, value: 5 },
    armor: null,
    skillPoints: 1, ranks: {}, slots: [null, null, null, null], cds: {},      // skills: the starter skill is learned for free
    buffs: { warcry: 0, wcArmor: 0, evade: 0, shadow: false }, whirl: null, bonus: {}
  };
  p.ranks[c.start] = 1; p.slots[0] = c.start;
  return p;
}

function newRun(clsId) {
  seed = freshSeed();
  depth = 1; kills = 0;
  P = makePlayer(clsId || 'warrior');
  recalc(); P.hp = P.maxhp; P.mp = P.maxmp;
  messages = []; texts = [];
  invOpen = false; treeOpen = false; hintT = 20;
  autosaveOK = !saveExists();      // never let a fresh run silently overwrite an existing save
  buildLevel();
}

function buildLevel() {
  rnd = mulberry32(levelSeed());
  generateDungeon();
  enemies = []; ground = []; projectiles = []; effects = []; pending = [];
  const start = rooms[0];
  P.x = start.cx * TS + TS / 2; P.y = start.cy * TS + TS / 2;
  P.path = []; P.target = null; P.pickup = null;
  // populate rooms
  for (let i = 1; i < rooms.length; i++) {
    const r = rooms[i];
    const n = Math.min(6, ri(1, 2) + (depth >> 1) + (r.stairs ? 1 : 0));
    for (let k = 0; k < n; k++) {
      const t = rnd(), type = t < 0.15 + 0.03 * depth ? 'archer' : (depth >= 2 && t < 0.45) ? 'brute' : 'grunt';
      spawnEnemy(type, r);
    }
  }
  if (depth % 3 === 0) {
    const r = rooms.find(q => q.stairs);
    const b = spawnEnemy('boss', r, r.cx * TS + TS / 2, r.cy * TS + TS / 2 - TS * 1.5);
    b.aggro = false;
    msg('A powerful presence lurks near the stairs...');
  }
  rnd = mulberry32(freshSeed());     // back to a non-deterministic stream for combat/loot
  for (let i = 0; i < MW * MH; i++) explored[i] = 0;
  mmDirty = true; reveal();
  msg('Depth ' + depth);
  saveBest();
}

function spawnEnemy(type, room, x, y) {
  const T = TYPES[type], mult = 1 + 0.3 * (depth - 1);
  if (x === undefined) {
    x = (room.x + ri(0, room.w - 1)) * TS + TS / 2;
    y = (room.y + ri(0, room.h - 1)) * TS + TS / 2;
  }
  const e = {
    type, T, x, y, r: T.r, hp: Math.round(T.hp * mult), maxhp: Math.round(T.hp * mult),
    dmg: T.dmg * mult, atk: 0.5 + rnd(), flash: 0, aggro: false, path: [], pathT: rnd() * 0.5,
    boss: !!T.boss, dead: false, burstT: 3
  };
  enemies.push(e);
  return e;
}

function reveal() {
  const ptx = Math.floor(P.x / TS), pty = Math.floor(P.y / TS), R = 8;
  for (let j = pty - R; j <= pty + R; j++) for (let i = ptx - R; i <= ptx + R; i++) {
    if (i < 0 || j < 0 || i >= MW || j >= MH) continue;
    if ((i - ptx) * (i - ptx) + (j - pty) * (j - pty) > R * R) continue;
    if (!explored[j * MW + i]) { explored[j * MW + i] = 1; mmDirty = true; }
  }
}

// ===================================================================
//  EFFECTS, TEXT, MESSAGES
// ===================================================================
function addText(x, y, s, color, size, dur) { texts.push({ x, y, dz: 0, s, color, size: size || 14, t: 0, dur: dur || 0.9 }); }
function addEffect(e) { e.t = 0; effects.push(e); }
function msg(s) { messages.push({ s, t: 0 }); if (messages.length > 4) messages.shift(); }

// ===================================================================
//  COMBAT
// ===================================================================
function hurtEnemy(e, dmg, crit, color) {
  if (e.dead) return;
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg; e.flash = 0.12; e.aggro = true;
  addText(e.x + (rnd() - 0.5) * 12, e.y + (rnd() - 0.5) * 12, String(dmg), color || (crit ? '#ffb020' : '#ffffff'), crit ? 20 : 14);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true; kills++;
  gainXp(Math.round(e.T.xp * (1 + 0.2 * (depth - 1))));
  const scatter = () => ({ x: e.x + (rnd() - 0.5) * 28, y: e.y + (rnd() - 0.5) * 28 });
  const drop = (o) => { const p = scatter(); if (blocked(p.x, p.y, 6)) { p.x = e.x; p.y = e.y; } o.x = p.x; o.y = p.y; o.t = rnd() * 6; ground.push(o); };
  if (e.boss || rnd() < 0.7) drop({ kind: 'gold', amount: Math.round(ri(3, 9) * (1 + depth * 0.5) * (e.boss ? 8 : 1)) });
  if (e.boss) { drop({ kind: 'item', item: genItem(depth, 2) }); drop({ kind: 'item', item: genItem(depth, 1) }); drop({ kind: 'hp' }); drop({ kind: 'mp' }); }
  else {
    if (rnd() < 0.22 + (e.type === 'brute' ? 0.1 : 0)) drop({ kind: 'item', item: genItem(depth) });
    if (rnd() < 0.14) drop({ kind: rnd() < 0.6 ? 'hp' : 'mp' });
  }
  if (e.boss) { msg('The Overlord is slain! The stairs are unlocked.'); addEffect({ type: 'ring', x: e.x, y: e.y, r0: 10, r1: 220, dur: 0.8, color: '255,80,120' }); }
}

function hurtPlayer(raw) {
  if (P.dead) return;
  if (P.bonus.dodge && rnd() < P.bonus.dodge) { addText(P.x, P.y, 'Dodge', '#9fe8ff', 14); return; }
  let dmg = raw * 20 / (20 + armorVal()) * (1 - P.bonus.reduce);
  if (P.buffs.evade > 0) dmg *= 0.4;
  dmg = Math.max(1, Math.round(dmg));
  P.hp -= dmg; P.flash = 0.15;
  addText(P.x, P.y, String(dmg), '#ff4040', 16);
  if (P.hp <= 0) { P.hp = 0; P.dead = true; P.deadTime = time; invOpen = false; treeOpen = false; P.path = []; P.target = null; mouse.down = false; saveBest(); }
}

function nearestEnemy(maxDist, needLOS) {
  let best = null, bd = maxDist;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = dist(P.x, P.y, e.x, e.y);
    if (d < bd && (!needLOS || clearLine(P.x, P.y, e.x, e.y, 3))) { bd = d; best = e; }
  }
  return best;
}
// Skills auto-aim at the nearest enemy; with none around, a mouse user aims at the cursor, otherwise we fire forward.
function aimAngle() {
  const t = nearestEnemy(520);
  if (t) return Math.atan2(t.y - P.y, t.x - P.x);
  if (lastPointerType === 'mouse') return Math.atan2(mouse.wy - P.y, mouse.wx - P.x);
  return P.face;
}
function usePotion(kind) {
  if (P.dead || P.potCd > 0 || P.potions[kind] <= 0) return;
  if (kind === 'hp') {
    if (P.hp >= P.maxhp) return;
    const h = Math.round(P.maxhp * 0.5); P.hp = Math.min(P.maxhp, P.hp + h);
    addText(P.x, P.y, '+' + h, '#5cff6a', 16);
  } else {
    if (P.mp >= P.maxmp) return;
    const m = Math.round(P.maxmp * 0.5); P.mp = Math.min(P.maxmp, P.mp + m);
    addText(P.x, P.y, '+' + m + ' MP', '#6ab4ff', 16);
  }
  P.potions[kind]--; P.potCd = 0.8;
}

function enemyShoot(e, a, speed, dmg) {
  projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 5, life: 2.5, friendly: false, dmg, color: '#ff5533' });
}

// ===================================================================
//  UPDATE
// ===================================================================
// Picking is done in SCREEN space against the projected sprites (mx,my = canvas coords).
const enemyH = e => e.T.sz * (e.boss ? 1.5 : e.type === 'brute' ? 1.4 : 1.3);
function enemyAt(mx, my, pad) {
  pad = pad || 0;
  let best = null, bk = -1e9;
  for (const e of enemies) {
    if (e.dead) continue;
    const sx = projX(e.x, e.y) - cam.x, sy = projY(e.x, e.y, 0) - cam.y, s = e.T.sz;
    if (Math.abs(mx - sx) <= s * 0.85 + pad && my >= sy - enemyH(e) - 4 - pad && my <= sy + s * 0.45 + pad && e.x + e.y > bk) { best = e; bk = e.x + e.y; }
  }
  return best;
}
function groundAt(mx, my, pad) {
  pad = pad || 0;
  for (const g of ground) {
    const sx = projX(g.x, g.y) - cam.x, sy = projY(g.x, g.y, 6) - cam.y;
    if (Math.abs(mx - sx) < 16 + pad && Math.abs(my - sy) < 14 + pad) return g;
  }
  return null;
}

const inAttackRange = e => {
  const A = cls().atk, d = dist(P.x, P.y, e.x, e.y);
  return A.kind === 'melee' ? d <= MELEE_RANGE + e.r + P.r : d <= A.range && clearLine(P.x, P.y, e.x, e.y, 3);
};

function updatePlayer(dt) {
  P.flash = Math.max(0, P.flash - dt); P.atkCd = Math.max(0, P.atkCd - dt); P.potCd = Math.max(0, P.potCd - dt);
  P.swing = Math.max(0, P.swing - dt);
  updateSkills(dt);
  P.speed = P.baseSpeed * (P.buffs.evade > 0 ? 1.5 : 1);
  P.mp = Math.min(P.maxmp, P.mp + manaRegen() * dt);
  P.repathT -= dt;

  if (mouse.down && mouse.mode === 'move' && P.repathT <= 0) {
    P.path = pathTo(P, mouse.wx, mouse.wy); P.repathT = 0.1;
  }
  if (P.target) {
    const e = P.target;
    if (e.dead) { P.target = null; if (mouse.down) mouse.mode = 'move'; }
    else {
      if (inAttackRange(e)) {
        P.path = []; P.face = Math.atan2(e.y - P.y, e.x - P.x);
        if (P.atkCd <= 0) autoAttack(e);
      } else if (P.repathT <= 0) { P.path = pathTo(P, e.x, e.y); P.repathT = 0.25; }
    }
  } else if (P.pickup) {
    if (!ground.includes(P.pickup)) P.pickup = null;
    else if (P.repathT <= 0) { P.path = pathTo(P, P.pickup.x, P.pickup.y); P.repathT = 0.3; }
  }
  // auto-attack (class flavored): melee hits the nearest enemy in reach, ranged classes fire at the nearest visible enemy
  if (P.atkCd <= 0) {
    const A = cls().atk;
    const n = A.kind === 'melee' ? nearestEnemy(MELEE_RANGE + P.r + 14) : nearestEnemy(A.range, true);
    if (n && inAttackRange(n)) autoAttack(n);
  }
  const ox = P.x, oy = P.y;
  followPath(P, P.path, P.speed, dt);
  if (P.x !== ox || P.y !== oy) P.face = Math.atan2(P.y - oy, P.x - ox);

  // pickups
  for (let i = ground.length - 1; i >= 0; i--) {
    const g = ground[i];
    if (dist(P.x, P.y, g.x, g.y) > 24) continue;
    if (g.kind === 'gold') { P.gold += g.amount; addText(P.x, P.y, '+' + g.amount + ' gold', '#f5c518', 13); }
    else if (g.kind === 'hp') { P.potions.hp++; addText(P.x, P.y, 'Health potion', '#ff7777', 13); }
    else if (g.kind === 'mp') { P.potions.mp++; addText(P.x, P.y, 'Mana potion', '#77aaff', 13); }
    else if (g.kind === 'item') {
      if (P.inv.length >= INV_SIZE) { if (time > fullMsgT) { msg('Inventory full!'); fullMsgT = time + 1.5; } continue; }
      P.inv.push(g.item); addText(P.x, P.y, g.item.name, RARITY_COLOR[g.item.rar], 13, 1.4);
    }
    if (P.pickup === g) P.pickup = null;
    ground.splice(i, 1);
  }

  // stairs
  const tx = Math.floor(P.x / TS), ty = Math.floor(P.y / TS);
  if (tx === stairs.tx && ty === stairs.ty) {
    if (enemies.some(e => e.boss && !e.dead)) { if (time > fullMsgT) { msg('The stairs are sealed until the Overlord dies.'); fullMsgT = time + 2; } }
    else { depth++; buildLevel(); autosave('stairs'); }
  }
  reveal();
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    e.atk -= dt; e.flash = Math.max(0, e.flash - dt); e.pathT -= dt;
    tickStatus(e, dt);
    if (e.dead) continue;
    const T = e.T, d = dist(e.x, e.y, P.x, P.y);
    const spd = T.spd * (e.slow > 0 ? e.slowF : 1);
    if (e.stun > 0) continue;                      // stunned: no movement or attacks
    if (!e.aggro) {
      if (!P.dead && d < T.aggro && (d < 110 || clearLine(e.x, e.y, P.x, P.y, 2))) e.aggro = true;
      else continue;
    } else if (d > T.aggro * 2.5 || P.dead) { e.aggro = false; continue; }

    const los = clearLine(e.x, e.y, P.x, P.y, 2);
    const chase = () => {
      if (clearLine(e.x, e.y, P.x, P.y, e.r)) { e.path = [{ x: P.x, y: P.y }]; }
      else if (e.pathT <= 0 || !e.path.length) { e.path = findPath(e.x, e.y, P.x, P.y, e.r); e.pathT = 0.5; }
      followPath(e, e.path, spd, dt);
    };
    if (T.ranged) {
      if (d < 150 && los) {                       // keep distance
        moveEnt(e, (e.x - P.x) / d * spd * dt, (e.y - P.y) / d * spd * dt);
      } else if (d <= 330 && los) {
        if (e.atk <= 0) { enemyShoot(e, Math.atan2(P.y - e.y, P.x - e.x), 230, e.dmg); e.atk = T.cd; }
      } else chase();
    } else {
      if (d <= e.r + P.r + 10) {
        if (e.atk <= 0) { hurtPlayer(e.dmg * (0.85 + rnd() * 0.3)); e.atk = T.cd; }
      } else chase();
    }
    if (e.boss) {                                  // radial burst
      e.burstT -= dt;
      if (e.burstT <= 0) {
        e.burstT = e.hp < e.maxhp * 0.5 ? 2 : 3.2;
        const off = rnd() * 6.28;
        for (let k = 0; k < 12; k++) enemyShoot(e, off + k * Math.PI / 6, 190, e.dmg * 0.5);
        addEffect({ type: 'ring', x: e.x, y: e.y, r0: 10, r1: 60, dur: 0.3, color: '255,80,50' });
      }
    }
  }
  // separation so enemies don't stack
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i]; if (a.dead || !a.aggro) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j]; if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d > 0.001 && d < m) { const p = (m - d) / 2 / d; moveEnt(a, -dx * p, -dy * p); moveEnt(b, dx * p, dy * p); }
    }
  }
  enemies = enemies.filter(e => !e.dead);
}

function updateProjectiles(dt) {
  for (const p of projectiles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    let hit = p.life <= 0 || solid(p.x, p.y);
    if (!hit && p.friendly) {
      for (const e of enemies) {
        if (e.dead || (p.hits && p.hits.has(e)) || dist(p.x, p.y, e.x, e.y) >= e.r + p.r) continue;
        if (p.aoe) { hit = true; break; }            // exploding projectile: resolved below
        projectileHit(p, e);
        if (p.pierce > 0) { p.pierce--; (p.hits = p.hits || new Set()).add(e); } else { hit = true; break; }
      }
    } else if (!hit && !p.friendly && !P.dead && dist(p.x, p.y, P.x, P.y) < P.r + p.r) {
      hit = true; hurtPlayer(p.dmg);
    }
    if (hit) {
      p.dead = true;
      if (p.friendly && p.aoe) {
        addEffect({ type: 'ring', x: p.x, y: p.y, r0: 6, r1: p.aoe, dur: 0.25, color: p.ringColor || '255,140,30' });
        for (const e of enemies) if (!e.dead && dist(p.x, p.y, e.x, e.y) < p.aoe + e.r) projectileHit(p, e);
      }
    }
  }
  projectiles = projectiles.filter(p => !p.dead);
}

function update(dt) {
  if (paused || titleOpen || classSelectOpen) return;
  time += dt; hintT = Math.max(0, hintT - dt);
  if (!P.dead) updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updatePending(dt);
  for (const t of texts) { t.t += dt; t.dz += 28 * dt; }
  texts = texts.filter(t => t.t < t.dur);
  for (const f of effects) f.t += dt;
  effects = effects.filter(f => f.t < f.dur);
  for (const m of messages) m.t += dt;
  messages = messages.filter(m => m.t < 4);
  // camera
  cam.x = Math.round(projX(P.x, P.y) - W / 2); cam.y = Math.round(projY(P.x, P.y, 0) - H / 2 - 10);
  updateMouseWorld();
}
