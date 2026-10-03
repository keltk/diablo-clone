'use strict';
// Class-select screen and the skill-tree panel (layout, drawing, tap handling).
// Plain script (no modules): shares globals with the other files in js/.

// ===================================================================
//  CLASS SELECT
// ===================================================================
function openClassSelect() {
  classSelectOpen = true; titleOpen = false; paused = false; invOpen = false; treeOpen = false;
}
function pickClass(id) {
  if (!CLASSES[id]) return;
  classSelectOpen = false;
  newRun(id);
  treeSel = null; slotSel = null;
}

function classCards() {
  const portrait = W < H * 1.1, top = Math.max(60, 80 * Math.min(1, W / 600)), out = [];
  if (portrait) {
    const cw = Math.min(480, W - 24), gap = 10, ch = clamp((H - top - 70) / 3 - gap, 110, 200);
    CLASS_IDS.forEach((id, i) => out.push({ id, x: (W - cw) / 2, y: top + i * (ch + gap), w: cw, h: ch, portrait }));
  } else {
    const total = Math.min(W - 24, 960), gap = 12, cw = (total - 2 * gap) / 3, ch = Math.min(H - top - 50, 340);
    CLASS_IDS.forEach((id, i) => out.push({ id, x: (W - total) / 2 + i * (cw + gap), y: top + Math.max(0, (H - top - 50 - ch) / 2), w: cw, h: ch, portrait }));
  }
  return out;
}

function classPress(p) {
  for (const c of classCards()) if (inRect(c, p.x, p.y)) { pickClass(c.id); return; }
}

// little front-facing blocky figure; (cx, by) = bottom centre
function drawClassFigure(id, cx, by, u) {
  const c = CLASSES[id];
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, by, u * 1.1, u * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  const bw = u * 1.3, bh = u * 1.5;
  ctx.fillStyle = c.color; ctx.fillRect(cx - bw / 2, by - bh, bw, bh);                       // body
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx, by - bh, bw / 2, bh);
  const hs = u * 0.75;
  ctx.fillStyle = '#f2d6b0'; ctx.fillRect(cx - hs / 2, by - bh - hs + 2, hs, hs);            // head
  if (id === 'warrior') {
    ctx.fillStyle = '#aab2c4'; ctx.fillRect(cx - hs / 2 - 2, by - bh - hs - 2, hs + 4, hs * 0.45);   // helmet
    ctx.fillStyle = '#7d8599'; ctx.fillRect(cx - bw / 2 - u * 0.55, by - bh * 0.9, u * 0.55, bh * 0.7);  // shield
    ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = Math.max(3, u * 0.18); ctx.beginPath();
    ctx.moveTo(cx + bw / 2 + u * 0.3, by - bh * 0.3); ctx.lineTo(cx + bw / 2 + u * 0.3, by - bh * 1.5); ctx.stroke();                     // sword
  } else if (id === 'mage') {
    ctx.fillStyle = '#3a2f80'; ctx.beginPath(); ctx.moveTo(cx - hs * 0.8, by - bh - hs + 4); ctx.lineTo(cx + hs * 0.8, by - bh - hs + 4); ctx.lineTo(cx, by - bh - hs * 2.3); ctx.closePath(); ctx.fill();   // hat
    ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = Math.max(3, u * 0.14); ctx.beginPath();
    ctx.moveTo(cx + bw / 2 + u * 0.35, by); ctx.lineTo(cx + bw / 2 + u * 0.35, by - bh * 1.6); ctx.stroke();                              // staff
    ctx.fillStyle = '#b48cff'; ctx.fillRect(cx + bw / 2 + u * 0.35 - u * 0.2, by - bh * 1.6 - u * 0.4, u * 0.4, u * 0.4);
  } else {
    ctx.fillStyle = '#1f3a2a'; ctx.fillRect(cx - hs / 2 - 2, by - bh - hs - 2, hs + 4, hs * 0.6);                                          // hood
    ctx.fillRect(cx - hs / 2 - 2, by - bh - hs - 2, 4, hs + 4);
    ctx.strokeStyle = '#e6e6e6'; ctx.lineWidth = Math.max(2, u * 0.12);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * (bw / 2 + u * 0.3), by - bh * 0.2); ctx.lineTo(cx + s * (bw / 2 + u * 0.3), by - bh * 0.8); ctx.stroke(); }  // daggers
  }
}

function drawClassSelect() {
  ctx.fillStyle = 'rgba(0,0,0,0.88)'; ctx.fillRect(0, 0, W, H);
  const k = Math.max(0.7, Math.min(1, W / 600));
  text('CHOOSE YOUR CLASS', W / 2, Math.max(28, 36 * k), '#e8d9a8', 30 * k, 'center');
  for (const c of classCards()) {
    const cl = CLASSES[c.id], st = cl.atk.kind === 'melee' ? 'Melee' : 'Ranged';
    box(c.x, c.y, c.w, c.h, 'rgba(22,20,30,0.96)', cl.color);
    const lines = [['HP ' + cl.hp + '   Mana ' + cl.mp, '#cfd8ff'], ['Speed ' + cl.spd + '   Crit ' + Math.round(cl.crit * 100) + '%', '#cfd8ff'],
                   [st + ' auto-attack', '#cfd8ff'], ['Starts with ' + SKILLS[cl.start].name, '#ffe14d']];
    const fs = Math.round(13 * Math.max(k, 0.85));
    if (c.portrait) {
      const u = Math.min(c.h * 0.2, 30);
      drawClassFigure(c.id, c.x + c.w * 0.17, c.y + c.h * 0.78, u);
      const tx = c.x + c.w * 0.34;
      text(cl.name, tx, c.y + 24, cl.accent, 22 * k, 'left');
      text(cl.blurb, tx, c.y + 24 + 24 * k, '#bbb', fs, 'left');
      lines.forEach((l, i) => text(l[0], tx, c.y + c.h * 0.5 + i * (fs + 6) - 2, l[1], fs, 'left'));
    } else {
      drawClassFigure(c.id, c.x + c.w / 2, c.y + c.h * 0.42, Math.min(34, c.h * 0.11));
      text(cl.name, c.x + c.w / 2, c.y + c.h * 0.5, cl.accent, 24, 'center');
      text(cl.blurb, c.x + c.w / 2, c.y + c.h * 0.5 + 24, '#bbb', 13, 'center');
      lines.forEach((l, i) => text(l[0], c.x + c.w / 2, c.y + c.h * 0.5 + 54 + i * 20, l[1], 13, 'center'));
    }
  }
  text(touchDevice ? 'Tap a class to begin' : 'Click a class (or press 1 / 2 / 3) to begin', W / 2, H - 22, '#888', 14, 'center');
}

// ===================================================================
//  SKILL TREE PANEL
// ===================================================================
const TREE = { x: 0, y: 0, s: 1, w: 540, h: 690, wide: false };
let treeSel = null;        // selected skill id
let slotSel = null;        // selected skill-bar slot
let respecArmed = 0;       // performance.now() deadline of the "tap again to reset" confirm

function layoutTree() {
  TREE.wide = W > H * 1.15 && H < 720;                // short landscape screens: two-column layout
  TREE.w = TREE.wide ? 760 : 540; TREE.h = TREE.wide ? 420 : 690;
  let ps = clamp(52 / (76 * VZ), 1, 1.5);
  ps = Math.min(ps, (W - 12) / TREE.w, (H - 12) / TREE.h);
  TREE.s = ps; TREE.x = Math.round((W - TREE.w * ps) / 2); TREE.y = Math.round((H - TREE.h * ps) / 2);
}
function treeGeo() {
  return TREE.wide ? {
    close: { x: 706, y: 6, w: 44, h: 44 }, slotsY: 70, slotX: i => 20 + i * 66, slotS: 56,
    nodeX: b => 20 + b * 100, nodeY: t => 150 + t * 88, nodeS: 76, headerY: 138,
    detail: { x: 340, y: 64, w: 400, h: 240 }, learn: { x: 340, y: 312, w: 195, h: 50 }, equip: { x: 545, y: 312, w: 195, h: 50 }, respec: { x: 340, y: 370, w: 195, h: 40 }
  } : {
    close: { x: 490, y: 6, w: 44, h: 44 }, slotsY: 70, slotX: i => (540 - (4 * 66 - 10)) / 2 + i * 66, slotS: 56,
    nodeX: b => 75 + b * 150, nodeY: t => 160 + t * 100, nodeS: 90, headerY: 146,
    detail: { x: 20, y: 456, w: 500, h: 126 }, learn: { x: 20, y: 590, w: 245, h: 46 }, equip: { x: 275, y: 590, w: 245, h: 46 }, respec: { x: 20, y: 644, w: 245, h: 36 }
  };
}
const nodeRect = (g, branch, tier) => ({ x: g.nodeX(branch), y: g.nodeY(tier), w: g.nodeS, h: g.nodeS });
const slotRectT = (g, i) => ({ x: g.slotX(i), y: g.slotsY, w: g.slotS, h: g.slotS });
const toTree = (x, y) => ({ x: (x - TREE.x) / TREE.s, y: (y - TREE.y) / TREE.s });
const inTree = (x, y) => { const p = toTree(x, y); return p.x >= 0 && p.y >= 0 && p.x < TREE.w && p.y < TREE.h; };

function toggleTree() { if (P.dead) return; treeOpen = !treeOpen; invOpen = false; if (!treeOpen) { slotSel = null; } else if (!treeSel) treeSel = CLASSES[P.cls].start; }
function openSkillTree(slot) {
  treeOpen = true; invOpen = false; paused = false;
  slotSel = slot === undefined ? null : slot;
  if (!treeSel) treeSel = CLASSES[P.cls].start;
}
function equipTarget() { return slotSel !== null ? slotSel : Math.max(0, P.slots.indexOf(null)); }

function treePress(x, y) {
  const g = treeGeo(), p = toTree(x, y), c = CLASSES[P.cls];
  if (inRect(g.close, p.x, p.y)) { treeOpen = false; slotSel = null; return; }
  for (let i = 0; i < 4; i++) if (inRect(slotRectT(g, i), p.x, p.y)) {
    slotSel = slotSel === i ? null : i;
    if (slotSel !== null && P.slots[i]) treeSel = P.slots[i];
    return;
  }
  for (let b = 0; b < 3; b++) for (let t = 0; t < 3; t++) if (inRect(nodeRect(g, b, t), p.x, p.y)) {
    const id = c.tree[b][t]; treeSel = id;
    if (slotSel !== null && SKILLS[id].kind === 'active' && rankOf(id) > 0) { equipSkill(id, slotSel); slotSel = null; }
    return;
  }
  if (inRect(g.respec, p.x, p.y)) {
    if (performance.now() < respecArmed) { respecSkills(); respecArmed = 0; treeSel = c.start; slotSel = null; msg('Skills reset - points refunded'); }
    else respecArmed = performance.now() + 3000;
    return;
  }
  if (!treeSel) return;
  const def = SKILLS[treeSel], r = rankOf(treeSel);
  if (inRect(g.learn, p.x, p.y)) { learnSkill(treeSel); return; }
  if (inRect(g.equip, p.x, p.y) && def.kind === 'active' && r > 0) {
    if (slotSel === null && P.slots.includes(treeSel)) P.slots[P.slots.indexOf(treeSel)] = null;      // unequip
    else { equipSkill(treeSel, equipTarget()); slotSel = null; }
  }
}

function wrapText(str, maxW, size) {
  ctx.font = 'bold ' + size + 'px monospace';
  const lines = []; let cur = '';
  for (const w of str.split(' ')) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  lines.push(cur);
  return lines;
}

function drawTree() {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
  const g = treeGeo(), c = CLASSES[P.cls];
  ctx.save(); ctx.translate(TREE.x, TREE.y); ctx.scale(TREE.s, TREE.s);
  box(0, 0, TREE.w, TREE.h, 'rgba(18,16,24,0.97)', '#8a7a55');
  text(c.name + ' skills', 20, 26, c.accent, 18, 'left');
  text('Points: ' + P.skillPoints, TREE.wide ? 300 : 300, 26, P.skillPoints > 0 ? '#7dff9a' : '#999', 16, 'left');
  btnBox(g.close, 'X', '#7a2a2a', true);
  // skill bar slots
  text('Skill bar (tap a slot, then a skill)', 20, 58, '#888', 11, 'left');
  for (let i = 0; i < 4; i++) {
    const r = slotRectT(g, i), id = P.slots[i], def = id && SKILLS[id];
    box(r.x, r.y, r.w, r.h, def ? def.color : '#0d0d12', slotSel === i ? '#fff' : '#555');
    if (def) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); text(def.short, r.x + r.w / 2, r.y + r.h / 2, '#fff', 12, 'center'); }
    else text('+', r.x + r.w / 2, r.y + r.h / 2, '#666', 22, 'center');
    text(String(i + 1), r.x + 8, r.y + 9, '#ffe14d', 11, 'center');
    if (slotSel === i) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); }
  }
  // branch columns
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
  for (let b = 0; b < 3; b++) {
    const hr = nodeRect(g, b, 0);
    text(c.branches[b], hr.x + g.nodeS / 2, g.headerY, '#cdbb8a', 13, 'center');
    for (let t = 0; t < 3; t++) {                        // prerequisite connector to the tier above
      if (t === 0) continue;
      const a = nodeRect(g, b, t - 1), d = nodeRect(g, b, t), on = rankOf(c.tree[b][t - 1]) > 0;
      ctx.fillStyle = on ? '#8a7a55' : '#333'; ctx.fillRect(a.x + a.w / 2 - 2, a.y + a.h, 4, d.y - a.y - a.h);
    }
    for (let t = 0; t < 3; t++) {
      const id = c.tree[b][t], def = SKILLS[id], r = rankOf(id), st = learnStatus(id), rc = nodeRect(g, b, t);
      const locked = r === 0 && st.locked, maxed = r >= MAX_RANK, canBuy = st.ok;
      const cx = rc.x + rc.w / 2, cy = rc.y + rc.h / 2;
      ctx.fillStyle = locked ? '#16161c' : r > 0 ? def.color : '#23232c';
      if (def.kind === 'passive') { ctx.beginPath(); ctx.arc(cx, cy, rc.w / 2, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
      if (r > 0) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; if (def.kind === 'passive') { ctx.beginPath(); ctx.arc(cx, cy, rc.w / 2, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(rc.x, rc.y, rc.w, rc.h); }
      ctx.lineWidth = 3; ctx.strokeStyle = maxed ? '#ffd93b' : canBuy ? 'rgba(125,255,154,' + (0.5 + 0.5 * pulse) + ')' : locked ? '#2a2a32' : r > 0 ? '#aaa' : '#555';
      if (def.kind === 'passive') { ctx.beginPath(); ctx.arc(cx, cy, rc.w / 2, 0, Math.PI * 2); ctx.stroke(); } else ctx.strokeRect(rc.x + 1.5, rc.y + 1.5, rc.w - 3, rc.h - 3);
      if (treeSel === id) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; if (def.kind === 'passive') { ctx.beginPath(); ctx.arc(cx, cy, rc.w / 2 + 4, 0, Math.PI * 2); ctx.stroke(); } else ctx.strokeRect(rc.x - 3, rc.y - 3, rc.w + 6, rc.h + 6); }
      text(def.short, cx, cy - 6, locked ? '#555' : '#fff', 13, 'center');
      text(locked ? 'Lv' + TIER_LEVEL[t] : r + '/' + MAX_RANK, cx, cy + 14, locked ? '#555' : maxed ? '#ffd93b' : '#ddd', 12, 'center');
      const sl = P.slots.indexOf(id);
      if (sl >= 0) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(rc.x + 10, rc.y + 10, 9, 0, Math.PI * 2); ctx.fill(); text(String(sl + 1), rc.x + 10, rc.y + 10, '#ffe14d', 11, 'center'); }
    }
  }
  // detail area
  const dr = g.detail;
  box(dr.x, dr.y, dr.w, dr.h, 'rgba(10,10,16,0.9)', '#444');
  if (treeSel) {
    const def = SKILLS[treeSel], r = rankOf(treeSel), st = learnStatus(treeSel), pos = skillPos(treeSel);
    let y = dr.y + 18; const lh = 15, x = dr.x + 10, mw = dr.w - 20;
    text(def.name, x, y, def.color, 16, 'left'); y += 20;
    text((def.kind === 'active' ? 'Active' : 'Passive') + ' - tier ' + (pos.tier + 1) + (st.locked ? '  (' + st.reason + ')' : ''), x, y, st.locked ? '#e08080' : '#999', 11, 'left'); y += lh + 2;
    for (const l of wrapText(def.text, mw, 12)) { text(l, x, y, '#ddd', 12, 'left'); y += lh; }
    y += 3;
    text('Rank ' + r + '/' + MAX_RANK, x, y, '#ffe14d', 12, 'left'); y += lh;
    if (r > 0) for (const l of wrapText('Now:  ' + def.fx(r), mw, 12)) { text(l, x, y, '#9fe39f', 12, 'left'); y += lh; }
    if (r < MAX_RANK) for (const l of wrapText('Next: ' + def.fx(r + 1), mw, 12)) { text(l, x, y, '#8ab8ff', 12, 'left'); y += lh; }
    if (def.kind === 'active') text('Mana ' + manaCost(def, Math.max(1, r)) + '   Cooldown ' + cdOf(def, Math.max(1, r)).toFixed(1) + 's', x, y, '#aaa', 12, 'left');
    // buttons
    const canEquip = def.kind === 'active' && r > 0;
    const learnLabel = r >= MAX_RANK ? 'Maxed' : st.ok ? (r === 0 ? 'Learn (1 pt)' : 'Rank up (1 pt)') : st.reason;
    btnBox(g.learn, learnLabel, '#2a6a3a', st.ok);
    let eqLabel = def.kind === 'passive' ? 'Passive' : r === 0 ? 'Learn first' : (slotSel === null && P.slots.includes(treeSel)) ? 'Unequip' : 'Equip to slot ' + (equipTarget() + 1);
    btnBox(g.equip, eqLabel, '#2a4a6a', canEquip);
  } else text('Tap a skill', dr.x + 10, dr.y + 22, '#888', 13, 'left');
  btnBox(g.respec, performance.now() < respecArmed ? 'Tap again to reset' : 'Reset skills', performance.now() < respecArmed ? '#a02020' : '#5a3a3a', true);
  ctx.restore();
}
