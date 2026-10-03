'use strict';
// Classes, skill definitions, skill-point rules and derived player stats.
// Plain script (no modules): shares globals with the other files in js/.
// (Skill *behaviour* lives in skills.js; this file is data + rules.)

const MAX_RANK = 5;
const TIER_LEVEL = [1, 3, 6];            // character level needed for tier 1 / 2 / 3 nodes (tier n also needs the node above it)

// tree[branch][tier] = skill id. Rows of the tree panel are tiers, columns are branches.
const CLASSES = {
  warrior: {
    id: 'warrior', name: 'Warrior', color: '#c0562b', accent: '#aab2c4',
    blurb: 'Tanky melee bruiser', detail: 'Lots of HP and armor. Auto-attacks in melee.',
    hp: 140, hpl: 22, mp: 40, mpl: 4, dmg: 6, dmgl: 2.5, spd: 165, regen: 2.5, crit: 0.05, armor: 3,
    atk: { kind: 'melee', cd: 0.5 }, start: 'cleave',
    branches: ['Slaying', 'Defense', 'Fury'],
    tree: [['cleave', 'bash', 'whirl'], ['ironskin', 'warcry', 'jugger'], ['rage', 'charge', 'slam']]
  },
  mage: {
    id: 'mage', name: 'Mage', color: '#6a5acd', accent: '#d9c8ff',
    blurb: 'Glass-cannon spellcaster', detail: 'Big mana pool and strong spells. Auto-fires arcane bolts.',
    hp: 80, hpl: 10, mp: 90, mpl: 10, dmg: 3, dmgl: 1.2, spd: 170, regen: 5, crit: 0.05, armor: 0,
    atk: { kind: 'bolt', cd: 0.6, range: 250, color: '#b48cff' }, start: 'fireball',
    branches: ['Fire', 'Frost', 'Arcane'],
    tree: [['fireball', 'meteor', 'pyro'], ['fnova', 'spear', 'mastery'], ['flow', 'lightning', 'blink']]
  },
  rogue: {
    id: 'rogue', name: 'Rogue', color: '#3a8a5a', accent: '#cfe8d6',
    blurb: 'Fast, crit-focused skirmisher', detail: 'Quick and deadly. Auto-throws daggers, high crit chance.',
    hp: 100, hpl: 14, mp: 55, mpl: 6, dmg: 4.5, dmgl: 1.8, spd: 195, regen: 3, crit: 0.15, armor: 1,
    atk: { kind: 'dagger', cd: 0.38, range: 200, color: '#e6e6e6' }, start: 'dagger',
    branches: ['Marksman', 'Venom', 'Shadow'],
    tree: [['dagger', 'multi', 'deadeye'], ['poison', 'fan', 'venom'], ['nimble', 'evade', 'step']]
  }
};
const CLASS_IDS = ['warrior', 'mage', 'rogue'];

// dmg: {kind:'wep'|'spell', m: weapon multiplier | base+lv*level, rk: extra per rank}.  fx(r): effect text for a rank.
const pct = v => Math.round(v * 100) + '%';
const SKILLS = {
  // ---------------- Warrior ----------------
  cleave: { cls: 'warrior', name: 'Cleave', short: 'Cleave', kind: 'active', color: '#e0703a', mana: 6, cd: 1.5, dmg: { kind: 'wep', m: 1.3, rk: 0.15 },
    text: 'Sweep your weapon in an arc, hitting every enemy in front of you.', fx: r => 'Damage ' + Math.round(skillDmg(SKILLS.cleave, r)) },
  bash: { cls: 'warrior', name: 'Shield Bash', short: 'Bash', kind: 'active', color: '#c9b04a', mana: 10, cd: 5, cdRk: 0.3, dmg: { kind: 'wep', m: 1.8, rk: 0.15 },
    text: 'Slam the nearest enemy and stun it.', fx: r => 'Damage ' + Math.round(skillDmg(SKILLS.bash, r)) + ', stun ' + (0.8 + 0.2 * r).toFixed(1) + 's' },
  whirl: { cls: 'warrior', name: 'Whirlwind', short: 'Whirl', kind: 'active', color: '#d9d9e8', mana: 22, cd: 7, cdRk: 0.4, dmg: { kind: 'wep', m: 0.9, rk: 0.15 },
    text: 'Spin for 1.2s, hitting everything around you four times.', fx: r => 'Damage ' + Math.round(skillDmg(SKILLS.whirl, r)) + ' x4' },
  ironskin: { cls: 'warrior', name: 'Iron Skin', short: 'Iron', kind: 'passive', color: '#8a93a8', text: 'Hardened body: more armor and max HP.',
    fx: r => '+' + (4 * r) + ' armor, +' + pct(0.04 * r) + ' max HP' },
  warcry: { cls: 'warrior', name: 'War Cry', short: 'Cry', kind: 'active', color: '#ff9a3a', mana: 15, cd: 18, cdRk: 1, dmg: null,
    text: 'Bellow a war cry: more damage and armor for a while.', fx: r => '+30% damage, +' + (4 + 4 * r) + ' armor for ' + (8 + r) + 's' },
  jugger: { cls: 'warrior', name: 'Juggernaut', short: 'Jugg', kind: 'passive', color: '#7d8fb0', text: 'Unstoppable: more max HP and less damage taken.',
    fx: r => '+' + pct(0.06 * r) + ' max HP, -' + pct(0.03 * r) + ' damage taken' },
  rage: { cls: 'warrior', name: 'Battle Rage', short: 'Rage', kind: 'passive', color: '#e04040', text: 'Fury of battle: more damage and critical chance.',
    fx: r => '+' + pct(0.05 * r) + ' damage, +' + (1.5 * r).toFixed(1) + '% crit' },
  charge: { cls: 'warrior', name: 'Charge', short: 'Charge', kind: 'active', color: '#e8c070', mana: 12, cd: 6, cdRk: 0.4, dmg: { kind: 'wep', m: 1.5, rk: 0.15 },
    text: 'Dash at the nearest enemy and smash into it.', fx: r => 'Damage ' + Math.round(skillDmg(SKILLS.charge, r)) + ', short stun' },
  slam: { cls: 'warrior', name: 'Ground Slam', short: 'Slam', kind: 'active', color: '#b06a3a', mana: 30, cd: 10, cdRk: 0.5, dmg: { kind: 'wep', m: 2.4, rk: 0.2 },
    text: 'Pound the ground: heavy damage and stun around you.', fx: r => 'Damage ' + Math.round(skillDmg(SKILLS.slam, r)) + ', stun ' + (0.6 + 0.1 * r).toFixed(1) + 's' },
  // ---------------- Mage ----------------
  fireball: { cls: 'mage', name: 'Fireball', short: 'Fire', kind: 'active', color: '#ff8a1e', mana: 8, cd: 0.4, dmg: { kind: 'spell', base: 10, lv: 4, rk: 0.2 }, spell: true,
    text: 'Hurl a fireball that explodes on impact.', fx: r => 'Damage ' + Math.round(skillDmg(SKILLS.fireball, r)) + ', blast radius 55' },
  meteor: { cls: 'mage', name: 'Meteor', short: 'Meteor', kind: 'active', color: '#e0402a', mana: 30, cd: 9, cdRk: 0.5, dmg: { kind: 'spell', base: 30, lv: 8, rk: 0.25 }, spell: true,
    text: 'Call a meteor down on the nearest enemy. It lands after a short delay.', fx: r => 'Damage ' + Math.round(skillDmg(SKILLS.meteor, r)) + ', radius 95' },
  pyro: { cls: 'mage', name: 'Pyromania', short: 'Pyro', kind: 'passive', color: '#ff6a2a', text: 'Your spells burn hotter.', fx: r => '+' + pct(0.08 * r) + ' spell damage' },
  fnova: { cls: 'mage', name: 'Frost Nova', short: 'Frost', kind: 'active', color: '#6ec0ff', mana: 18, cd: 4, cdRk: 0.3, dmg: { kind: 'spell', base: 6, lv: 2.5, rk: 0.2 }, spell: true,
    text: 'A ring of frost damages and slows nearby enemies.', fx: r => 'Damage ' + Math.round(skillDmg(SKILLS.fnova, r)) + ', slow ' + (3 + 0.4 * r).toFixed(1) + 's' },
  spear: { cls: 'mage', name: 'Ice Spear', short: 'Spear', kind: 'active', color: '#9fe0ff', mana: 10, cd: 1.2, dmg: { kind: 'spell', base: 9, lv: 3.5, rk: 0.2 }, spell: true,
    text: 'A piercing spear of ice that slows everything it hits.', fx: r => 'Damage ' + Math.round(skillDmg(SKILLS.spear, r)) + ', pierces ' + (2 + (r >> 1)) },
  mastery: { cls: 'mage', name: 'Spell Mastery', short: 'Mastry', kind: 'passive', color: '#a08cff', text: 'Faster casting and mana recovery.', fx: r => '-' + pct(0.04 * r) + ' cooldowns, +' + (0.3 * r).toFixed(1) + ' mana/s' },
  flow: { cls: 'mage', name: 'Arcane Flow', short: 'Flow', kind: 'passive', color: '#7a8cff', text: 'A deeper mana pool that refills faster.', fx: r => '+' + pct(0.08 * r) + ' max mana, +' + (0.6 * r).toFixed(1) + ' mana/s' },
  lightning: { cls: 'mage', name: 'Chain Lightning', short: 'Bolt', kind: 'active', color: '#f2e45a', mana: 12, cd: 1.4, dmg: { kind: 'spell', base: 9, lv: 3.5, rk: 0.18 }, spell: true,
    text: 'Lightning leaps between nearby enemies.', fx: r => 'Damage ' + Math.round(skillDmg(SKILLS.lightning, r)) + ', jumps ' + (2 + r) + ' times' },
  blink: { cls: 'mage', name: 'Blink', short: 'Blink', kind: 'active', color: '#c58cff', mana: 14, cd: 8, cdRk: 1, dmg: null,
    text: 'Teleport away from the nearest enemy (or forward if none are near).', fx: r => 'Distance ' + (150 + 25 * r) },
  // ---------------- Rogue ----------------
  dagger: { cls: 'rogue', name: 'Dagger Throw', short: 'Dagger', kind: 'active', color: '#dcdcdc', mana: 5, cd: 0.5, dmg: { kind: 'wep', m: 1.4, rk: 0.15 },
    text: 'Throw a fast dagger that pierces one extra enemy.', fx: r => 'Damage ' + Math.round(skillDmg(SKILLS.dagger, r)) },
  multi: { cls: 'rogue', name: 'Multishot', short: 'Multi', kind: 'active', color: '#e8d27a', mana: 14, cd: 2.5, cdRk: 0.2, dmg: { kind: 'wep', m: 0.8, rk: 0.12 },
    text: 'Fire a fan of daggers.', fx: r => (3 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0)) + ' daggers, ' + Math.round(skillDmg(SKILLS.multi, r)) + ' each' },
  deadeye: { cls: 'rogue', name: 'Deadeye', short: 'Eye', kind: 'passive', color: '#f0c050', text: 'Critical hits happen more and hurt more.',
    fx: r => '+' + (3 * r) + '% crit, +' + pct(0.1 * r) + ' crit damage' },
  poison: { cls: 'rogue', name: 'Poison Dart', short: 'Poison', kind: 'active', color: '#7ad13a', mana: 9, cd: 2, dmg: { kind: 'wep', m: 0.5, rk: 0.1 },
    text: 'A dart coated in venom: poisons the target over time.', fx: r => 'Hit ' + Math.round(skillDmg(SKILLS.poison, r)) + ' + ' + Math.round(poisonDps(r)) + '/s for 5s' },
  fan: { cls: 'rogue', name: 'Blade Fan', short: 'Fan', kind: 'active', color: '#b8c8d8', mana: 16, cd: 4, cdRk: 0.3, dmg: { kind: 'wep', m: 1.1, rk: 0.15 },
    text: 'Throw daggers in every direction around you.', fx: r => 'Damage ' + Math.round(skillDmg(SKILLS.fan, r)) + ', radius 125' },
  venom: { cls: 'rogue', name: 'Venomous', short: 'Venom', kind: 'passive', color: '#5fb02a', text: 'Stronger, longer poison. Your thrown daggers sometimes poison.',
    fx: r => '+' + pct(0.15 * r) + ' poison damage, ' + (10 * r) + '% dagger poison chance' },
  nimble: { cls: 'rogue', name: 'Nimble', short: 'Nimble', kind: 'passive', color: '#6ad0a0', text: 'Light on your feet: faster movement and a chance to dodge.',
    fx: r => '+' + pct(0.03 * r) + ' speed, ' + (3 * r) + '% dodge' },
  evade: { cls: 'rogue', name: 'Evade', short: 'Evade', kind: 'active', color: '#7ad0e0', mana: 10, cd: 8, cdRk: 0.7, dmg: null,
    text: 'Roll away and move faster, taking much less damage for a moment.', fx: r => (2 + 0.3 * r).toFixed(1) + 's: +50% speed, -60% damage taken' },
  step: { cls: 'rogue', name: 'Shadow Step', short: 'Step', kind: 'active', color: '#8a6ad0', mana: 12, cd: 6, cdRk: 0.5, dmg: { kind: 'wep', m: 1.2, rk: 0.15 },
    text: 'Vanish and reappear behind the nearest enemy. Your next hit is a critical.', fx: r => 'Damage ' + Math.round(skillDmg(SKILLS.step, r)) + ', next hit crits' }
};
for (const id in SKILLS) SKILLS[id].id = id;

// ---- passive bonuses (recomputed by recalc) ----
function computeBonus() {
  const rk = id => (P.ranks[id] | 0);
  return {
    armor: 4 * rk('ironskin'), hpPct: 0.04 * rk('ironskin') + 0.06 * rk('jugger'), reduce: 0.03 * rk('jugger'),
    dmgPct: 0.05 * rk('rage'), crit: 0.015 * rk('rage') + 0.03 * rk('deadeye'), critDmg: 0.1 * rk('deadeye'),
    spellPct: 0.08 * rk('pyro'), cdr: 0.04 * rk('mastery'), regen: 0.3 * rk('mastery') + 0.6 * rk('flow'), mpPct: 0.08 * rk('flow'),
    poisonPct: 0.15 * rk('venom'), venomChance: 0.1 * rk('venom'), spdPct: 0.03 * rk('nimble'), dodge: 0.03 * rk('nimble')
  };
}

// ---- derived stats ----
const cls = () => CLASSES[P.cls];
const rankOf = id => (P.ranks[id] | 0);
const gear = k => ((P.weapon && P.weapon[k]) || 0) + ((P.armor && P.armor[k]) || 0);
const baseDmg = () => cls().dmg + cls().dmgl * (P.level - 1) + gear('dmg');
const armorVal = () => cls().armor + gear('armor') + P.bonus.armor + (P.buffs.warcry > 0 ? P.buffs.wcArmor : 0);
const dmgMult = def => 1 + P.bonus.dmgPct + (def && def.spell ? P.bonus.spellPct : 0) + (P.buffs.warcry > 0 ? 0.3 : 0);
const manaRegen = () => cls().regen + 0.15 * P.level + P.bonus.regen;
function recalc() {
  const c = cls();
  P.bonus = computeBonus();
  P.maxhp = Math.round((c.hp + c.hpl * (P.level - 1) + gear('hp')) * (1 + P.bonus.hpPct));
  P.maxmp = Math.round((c.mp + c.mpl * (P.level - 1)) * (1 + P.bonus.mpPct));
  P.baseSpeed = c.spd * (1 + P.bonus.spdPct);
  P.hp = Math.min(P.hp, P.maxhp);
  P.mp = Math.min(P.mp, P.maxmp);
}

function skillDmg(def, r) {
  const d = def.dmg; if (!d) return 0;
  const base = d.kind === 'wep' ? baseDmg() * d.m : d.base + P.level * d.lv + gear('dmg') * 0.5;
  return base * (1 + d.rk * (r - 1)) * dmgMult(def);
}
const manaCost = (def, r) => Math.max(1, Math.round(def.mana * (1 - 0.03 * (r - 1))));
const cdOf = (def, r) => Math.max(0.25, (def.cd - (def.cdRk || 0) * (r - 1)) * (1 - P.bonus.cdr));
const poisonDps = r => (3 + 1.1 * P.level) * (1 + 0.2 * (r - 1)) * (1 + P.bonus.poisonPct);

// ---- skill points / learning ----
function skillPos(id) {                   // -> { branch, tier } within the class tree
  const t = CLASSES[SKILLS[id].cls].tree;
  for (let b = 0; b < t.length; b++) for (let k = 0; k < t[b].length; k++) if (t[b][k] === id) return { branch: b, tier: k };
  return null;
}
function learnStatus(id) {                // -> { ok, reason }
  const def = SKILLS[id], pos = skillPos(id);
  if (!def || def.cls !== P.cls || !pos) return { ok: false, reason: 'Not your class' };
  if (rankOf(id) >= MAX_RANK) return { ok: false, reason: 'Maxed', maxed: true };
  if (P.level < TIER_LEVEL[pos.tier]) return { ok: false, reason: 'Needs level ' + TIER_LEVEL[pos.tier], locked: true };
  if (pos.tier > 0) {
    const need = CLASSES[P.cls].tree[pos.branch][pos.tier - 1];
    if (rankOf(need) < 1) return { ok: false, reason: 'Needs ' + SKILLS[need].name, locked: true };
  }
  if (P.skillPoints < 1) return { ok: false, reason: 'No skill points' };
  return { ok: true, reason: '' };
}
function learnSkill(id) {
  if (!learnStatus(id).ok) return false;
  P.skillPoints--; P.ranks[id] = rankOf(id) + 1;
  if (SKILLS[id].kind === 'active' && !P.slots.includes(id)) {       // auto-equip into the first free slot
    const i = P.slots.indexOf(null); if (i >= 0) P.slots[i] = id;
  }
  const frac = P.hp / P.maxhp; recalc(); P.hp = Math.min(P.maxhp, Math.max(P.hp, Math.round(frac * P.maxhp)));   // max-HP passives keep your HP fraction
  return true;
}
function equipSkill(id, slot) {
  if (!SKILLS[id] || SKILLS[id].kind !== 'active' || rankOf(id) < 1 || slot < 0 || slot > 3) return false;
  const old = P.slots.indexOf(id);
  if (old >= 0) P.slots[old] = P.slots[slot];       // swap if it was already on the bar
  P.slots[slot] = id;
  return true;
}
function respecSkills() {                 // free respec: refund every point, clear the bar
  P.ranks = {}; P.slots = [null, null, null, null];
  P.skillPoints = P.level + 1;            // 1 starting point + 1 per level (the starter skill counts as one)
  recalc();
}
function totalSkillPoints(level) { return level + 1; }
