'use strict';
// Item generation and player stats.
// Plain script (no modules): shares globals with the other files in js/.

// ===================================================================
//  ITEMS
// ===================================================================
const WEAPONS = ['Dagger', 'Sword', 'Axe', 'Mace', 'Blade', 'Cleaver'];
const ARMORS = ['Rags', 'Jerkin', 'Chain Mail', 'Breastplate', 'Plate Mail'];
const PRE_BLUE = ['Sturdy', 'Fine', 'Keen', 'Hardened'];
const PRE_YELLOW = ['Doom', 'Dread', 'Ember', 'Soul', 'Grim'];
const SUF_YELLOW = ['of Fury', 'of the Bear', 'of Woe', 'of Ages'];

function genItem(d, minRar) {
  const r = rnd();
  let rar = r < 0.06 + 0.01 * d ? 2 : r < 0.30 + 0.02 * d ? 1 : 0;
  rar = Math.max(rar, minRar || 0);
  const slot = rnd() < 0.5 ? 'weapon' : 'armor';
  const mult = [1, 1.35, 1.8][rar];
  const it = { slot, rar, dmg: 0, armor: 0, hp: 0 };
  let base;
  if (slot === 'weapon') {
    base = pick(WEAPONS);
    it.dmg = Math.max(1, Math.round((2 + d * 1.6 + ri(0, 3)) * mult));
    if (rar === 2) it.armor = ri(1, 3) + d;
  } else {
    base = pick(ARMORS);
    it.armor = Math.max(1, Math.round((2 + d * 1.8 + ri(0, 2)) * mult));
    if (rar === 2) it.dmg = ri(1, 2) + (d >> 1);
  }
  if (rar >= 1) it.hp = Math.round((ri(5, 12) + d * 3) * (rar === 2 ? 1.6 : 1));
  it.name = rar === 0 ? base : rar === 1 ? pick(PRE_BLUE) + ' ' + base : pick(PRE_YELLOW) + ' ' + base + ' ' + pick(SUF_YELLOW);
  it.value = Math.round(it.dmg * 5 + it.armor * 4 + it.hp * 0.5) + rar * 10;
  return it;
}

// ===================================================================
//  PLAYER STATS
// ===================================================================
// (gear(), baseDmg(), armorVal() and recalc() live in classes.js because they depend on the class and skills)
const xpNeed = lv => Math.round(40 * Math.pow(lv, 1.5));

function gainXp(n) {
  P.xp += n;
  while (P.xp >= xpNeed(P.level)) {
    P.xp -= xpNeed(P.level);
    P.level++; P.skillPoints++;
    recalc();
    P.hp = P.maxhp; P.mp = P.maxmp;
    addText(P.x, P.y, 'LEVEL UP!', '#ffe14d', 20, 1.6);
    addEffect({ type: 'ring', x: P.x, y: P.y, r0: 10, r1: 90, dur: 0.6, color: '255,225,77' });
    msg('Level ' + P.level + '! +1 skill point (T)');
  }
}
