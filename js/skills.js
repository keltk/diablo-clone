'use strict';
// Skill behaviour: damage dealing, status effects (slow / stun / poison), class auto-attacks and every skill's cast.
// Plain script (no modules): shares globals with the other files in js/.

let pending = [];                 // delayed effects, e.g. meteors: { t, fn }
let failTextT = 0;                // throttle for "No target" / "Not enough mana" floating text

const angTo = o => Math.atan2(o.y - P.y, o.x - P.x);
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// ---------------------------------------------------------------
//  Damage + statuses
// ---------------------------------------------------------------
// raw already includes skill/passive multipliers. Handles crit (incl. Shadow Step's guaranteed crit) and statuses.
function dealDamage(e, raw, o) {
  o = o || {};
  let crit = rnd() < cls().crit + P.bonus.crit;
  if (P.buffs.shadow) { crit = true; P.buffs.shadow = false; }
  const dmg = raw * (0.85 + rnd() * 0.3) * (crit ? 2 + P.bonus.critDmg : 1);
  hurtEnemy(e, dmg, crit);
  if (e.dead) return;
  if (o.slow) { e.slow = Math.max(e.slow || 0, o.slow[0]); e.slowF = o.slow[1]; }
  if (o.stun) e.stun = Math.max(e.stun || 0, o.stun);
  if (o.poison) { e.pois = { t: o.poison[1], dps: Math.max(o.poison[0], e.pois ? e.pois.dps : 0) }; e.poisAcc = e.poisAcc || 0; }
}

function tickStatus(e, dt) {
  if (e.stun > 0) e.stun -= dt;
  if (e.slow > 0) e.slow -= dt;
  if (e.pois && e.pois.t > 0) {
    e.pois.t -= dt; e.poisAcc = (e.poisAcc || 0) + dt;
    if (e.poisAcc >= 0.5) { e.poisAcc -= 0.5; hurtEnemy(e, e.pois.dps * 0.5, false, '#7ad13a'); }
    if (e.pois.t <= 0) e.pois = null;
  }
}

function projectileHit(p, e) {            // a friendly projectile touches enemy e
  dealDamage(e, p.dmg, { slow: p.slow, stun: p.stun, poison: p.poison || (p.venom && rnd() < p.venom ? [poisonDps(1) * 0.6, 3] : null) });
}

function fireProjectile(a, o) {
  const sp = o.speed || 480;
  projectiles.push(Object.assign({ x: P.x, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, life: 1.2, friendly: true }, o));
}

// ---------------------------------------------------------------
//  Class auto-attack (no click needed)
// ---------------------------------------------------------------
function autoAttack(e) {
  const A = cls().atk, a = angTo(e);
  P.atkCd = A.cd; P.swing = 0.15; P.face = a;
  const raw = baseDmg() * dmgMult(null);
  if (A.kind === 'melee') {
    dealDamage(e, raw);
    addEffect({ type: 'slash', x: P.x, y: P.y, a, dur: 0.15 });
  } else {
    fireProjectile(a, { speed: 560, r: A.kind === 'bolt' ? 5 : 4, life: A.range / 560 + 0.1, dmg: raw * (A.kind === 'bolt' ? 1.15 : 1),
      color: A.color, venom: A.kind === 'dagger' ? P.bonus.venomChance : 0 });
  }
}

// ---------------------------------------------------------------
//  Per-frame skill state
// ---------------------------------------------------------------
function updateSkills(dt) {
  for (const id in P.cds) if (P.cds[id] > 0) P.cds[id] = Math.max(0, P.cds[id] - dt);
  const b = P.buffs;
  b.warcry = Math.max(0, b.warcry - dt); b.evade = Math.max(0, b.evade - dt);
  const w = P.whirl;
  if (w) {
    w.t -= dt; w.tick -= dt;
    if (w.tick <= 0) {
      w.tick = 0.3;
      addEffect({ type: 'ring', x: P.x, y: P.y, r0: 20, r1: w.R, dur: 0.25, color: '230,230,255' });
      for (const e of enemies) if (!e.dead && dist(e.x, e.y, P.x, P.y) <= w.R + e.r) dealDamage(e, w.dmg);
    }
    if (w.t <= 0) P.whirl = null;
  }
}
function updatePending(dt) {
  for (const p of pending) { p.t -= dt; if (p.t <= 0) { p.done = true; p.fn(); } }
  pending = pending.filter(p => !p.done);
}

// ---------------------------------------------------------------
//  Casting
// ---------------------------------------------------------------
function failText(s) { if (time > failTextT) { addText(P.x, P.y, s, '#bbbbbb', 13); failTextT = time + 0.6; } }

function castSlot(i) {
  if (P.dead) return;
  const id = P.slots[i];
  if (!id) { openSkillTree(i); return; }             // empty slot: jump to the skill tree to fill it
  const def = SKILLS[id], r = rankOf(id);
  if (r < 1 || (P.cds[id] || 0) > 0) return;
  const cost = manaCost(def, r);
  if (P.mp < cost) { failText('Not enough mana'); return; }
  if (CAST[id](def, r) === false) { failText('No target'); return; }
  P.mp -= cost; P.cds[id] = cdOf(def, r);
}

// step the player in direction a up to dist px, stopping at walls. Returns distance moved.
function dash(a, distance) {
  let moved = 0;
  while (moved < distance) {
    const ox = P.x, oy = P.y, st = Math.min(6, distance - moved);
    moveEnt(P, Math.cos(a) * st, Math.sin(a) * st);
    if (Math.hypot(P.x - ox, P.y - oy) < st * 0.5) break;
    moved += st;
  }
  P.path = []; P.pickup = null;
  return moved;
}

const CAST = {
  // ---------------- Warrior ----------------
  cleave(d, r) {
    const t = nearestEnemy(120); if (!t) return false;
    const a = angTo(t), dmg = skillDmg(d, r); P.face = a; P.swing = 0.2;
    for (const e of enemies) if (!e.dead && dist(e.x, e.y, P.x, P.y) <= 85 + e.r && angDiff(angTo(e), a) <= 1.15) dealDamage(e, dmg);
    addEffect({ type: 'slash', x: P.x, y: P.y, a, dur: 0.22, rad: 60, half: 1.15 });
  },
  bash(d, r) {
    const t = nearestEnemy(75); if (!t) return false;
    P.face = angTo(t); P.swing = 0.2;
    dealDamage(t, skillDmg(d, r), { stun: 0.8 + 0.2 * r });
    addEffect({ type: 'ring', x: t.x, y: t.y, r0: 6, r1: 40, dur: 0.25, color: '255,230,120' });
  },
  whirl(d, r) {
    if (!nearestEnemy(160)) return false;
    P.whirl = { t: 1.2, tick: 0, dmg: skillDmg(d, r), R: 90 };
  },
  warcry(d, r) {
    P.buffs.warcry = 8 + r; P.buffs.wcArmor = 4 + 4 * r;
    addText(P.x, P.y, 'WAR CRY!', '#ff9a3a', 18, 1.2);
    addEffect({ type: 'ring', x: P.x, y: P.y, r0: 10, r1: 110, dur: 0.5, color: '255,150,60' });
  },
  charge(d, r) {
    const t = nearestEnemy(380); if (!t) return false;
    const a = angTo(t), want = Math.max(0, dist(P.x, P.y, t.x, t.y) - (t.r + P.r + 12));
    P.face = a; dash(a, Math.min(want, 300));
    addEffect({ type: 'ring', x: P.x, y: P.y, r0: 6, r1: 60, dur: 0.25, color: '240,200,120' });
    const dmg = skillDmg(d, r);
    for (const e of enemies) if (!e.dead && dist(e.x, e.y, P.x, P.y) <= 62 + e.r) dealDamage(e, dmg, { stun: 0.5 });
  },
  slam(d, r) {
    if (!nearestEnemy(170)) return false;
    const R = 130, dmg = skillDmg(d, r);
    addEffect({ type: 'ring', x: P.x, y: P.y, r0: 10, r1: R, dur: 0.4, color: '200,120,60' });
    for (const e of enemies) if (!e.dead && dist(e.x, e.y, P.x, P.y) <= R + e.r) dealDamage(e, dmg, { stun: 0.6 + 0.1 * r });
  },
  // ---------------- Mage ----------------
  fireball(d, r) {
    const a = aimAngle(); P.face = a;
    fireProjectile(a, { speed: 480, r: 7, life: 1.3, dmg: skillDmg(d, r), color: '#ff8a1e', aoe: 55, ringColor: '255,140,30' });
  },
  meteor(d, r) {
    const t = nearestEnemy(520); if (!t) return false;
    const x = t.x, y = t.y, dmg = skillDmg(d, r), R = 95;
    addEffect({ type: 'marker', x, y, r: R, dur: 0.9, color: '255,70,40' });
    pending.push({ t: 0.9, fn: () => {
      addEffect({ type: 'ring', x, y, r0: 10, r1: R + 20, dur: 0.45, color: '255,120,40' });
      for (const e of enemies) if (!e.dead && dist(e.x, e.y, x, y) <= R + e.r) dealDamage(e, dmg);
    } });
  },
  fnova(d, r) {
    const R = 150;
    if (!nearestEnemy(R + 50)) return false;
    const dmg = skillDmg(d, r);
    addEffect({ type: 'ring', x: P.x, y: P.y, r0: 10, r1: R, dur: 0.4, color: '110,190,255' });
    for (const e of enemies) if (!e.dead && dist(e.x, e.y, P.x, P.y) <= R + e.r) dealDamage(e, dmg, { slow: [3 + 0.4 * r, 0.45] });
  },
  spear(d, r) {
    const a = aimAngle(); P.face = a;
    fireProjectile(a, { speed: 560, r: 6, life: 0.9, dmg: skillDmg(d, r), color: '#9fe0ff', pierce: 2 + (r >> 1), slow: [2, 0.55] });
  },
  lightning(d, r) {
    let cur = nearestEnemy(400); if (!cur) return false;
    const dmg = skillDmg(d, r), seen = new Set(), pts = [{ x: P.x, y: P.y }];
    P.face = angTo(cur);
    for (let i = 0; i < 3 + r && cur; i++) {
      seen.add(cur); pts.push({ x: cur.x, y: cur.y });
      dealDamage(cur, dmg * Math.pow(0.9, i));
      let next = null, bd = 170;
      for (const e of enemies) { if (e.dead || seen.has(e)) continue; const dd = dist(e.x, e.y, cur.x, cur.y); if (dd < bd) { bd = dd; next = e; } }
      cur = next;
    }
    addEffect({ type: 'bolt', pts, dur: 0.22 });
  },
  blink(d, r) {
    const t = nearestEnemy(350);
    const a = t ? angTo(t) + Math.PI : aimAngle();
    const sx = P.x, sy = P.y;
    const moved = dash(a, 150 + 25 * r);
    if (moved < 30) { P.x = sx; P.y = sy; return false; }
    P.target = null;
    addEffect({ type: 'ring', x: sx, y: sy, r0: 20, r1: 4, dur: 0.3, color: '200,140,255' });
    addEffect({ type: 'ring', x: P.x, y: P.y, r0: 4, r1: 30, dur: 0.3, color: '200,140,255' });
  },
  // ---------------- Rogue ----------------
  dagger(d, r) {
    const a = aimAngle(); P.face = a;
    fireProjectile(a, { speed: 640, r: 5, life: 0.8, dmg: skillDmg(d, r), color: '#f0f0f0', pierce: 1 });
  },
  multi(d, r) {
    const n = 3 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0), a = aimAngle(), dmg = skillDmg(d, r); P.face = a;
    for (let i = 0; i < n; i++) fireProjectile(a + (i - (n - 1) / 2) * 0.2, { speed: 600, r: 4, life: 0.65, dmg, color: '#e8d27a' });
  },
  poison(d, r) {
    const a = aimAngle(); P.face = a;
    fireProjectile(a, { speed: 560, r: 5, life: 0.85, dmg: skillDmg(d, r), color: '#7ad13a', poison: [poisonDps(r), 5 + (P.ranks.venom | 0) * 0.5] });
  },
  fan(d, r) {
    const R = 125;
    if (!nearestEnemy(R + 30)) return false;
    const dmg = skillDmg(d, r);
    addEffect({ type: 'ring', x: P.x, y: P.y, r0: 10, r1: R, dur: 0.3, color: '200,215,230' });
    for (const e of enemies) if (!e.dead && dist(e.x, e.y, P.x, P.y) <= R + e.r) dealDamage(e, dmg);
  },
  evade(d, r) {
    const t = nearestEnemy(300);
    P.buffs.evade = 2 + 0.3 * r;
    dash(t ? angTo(t) + Math.PI : P.face + Math.PI, 90);
    addEffect({ type: 'ring', x: P.x, y: P.y, r0: 20, r1: 60, dur: 0.3, color: '120,210,230' });
  },
  step(d, r) {
    const t = nearestEnemy(400); if (!t) return false;
    const a = angTo(t), sx = P.x, sy = P.y;
    // reappear just behind the enemy (try the straight-behind spot, then the sides)
    for (const off of [0, 0.9, -0.9, 1.8, -1.8]) {
      const dx = t.x + Math.cos(a + off) * (t.r + P.r + 8), dy = t.y + Math.sin(a + off) * (t.r + P.r + 8);
      if (!blocked(dx, dy, P.r)) {
        addEffect({ type: 'ring', x: sx, y: sy, r0: 20, r1: 4, dur: 0.3, color: '140,100,210' });
        P.x = dx; P.y = dy; P.path = []; P.face = a + Math.PI; P.buffs.shadow = true;
        addEffect({ type: 'ring', x: P.x, y: P.y, r0: 4, r1: 36, dur: 0.3, color: '140,100,210' });
        dealDamage(t, skillDmg(d, r));
        P.buffs.shadow = true;            // the opener spends the crit; arm the next hit too
        return true;
      }
    }
    return false;
  }
};
