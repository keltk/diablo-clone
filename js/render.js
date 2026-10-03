'use strict';
// World rendering: iso helpers, tiles, walls, entities, effects.
// Plain script (no modules): shares globals with the other files in js/.

// ===================================================================
//  RENDERING
// ===================================================================
function text(s, x, y, color, size, align) {
  ctx.font = 'bold ' + (size || 14) + 'px monospace';
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(s, x, y);
  ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
}
function box(x, y, w, h, fill, stroke) {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); }
}

let vignette;
function makeVignette() {
  vignette = ctx.createRadialGradient(W / 2, H / 2, 140, W / 2, H / 2, clamp(Math.hypot(W, H) * 0.4, 400, 620));
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.88)');
}

// ---- iso drawing helpers ----
function shade(hex, f) {
  const n = parseInt(hex.slice(1, 7), 16);
  const c = v => clamp(Math.round(v * f), 0, 255);
  return 'rgb(' + c(n >> 16) + ',' + c((n >> 8) & 255) + ',' + c(n & 255) + ')';
}
function poly(pts, fill, stroke) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
// Extruded box over the world rectangle [x0,x1]x[y0,y1], from height z0 to z1. Shaded left/right faces + top.
function isoBox(x0, y0, x1, y1, z0, z1, cTop, cLeft, cRight) {
  const ax = projX(x0, y0) - cam.x, ay = projY(x0, y0, 0) - cam.y;   // back corner
  const bx = projX(x1, y0) - cam.x, by = projY(x1, y0, 0) - cam.y;   // right corner
  const cx = projX(x1, y1) - cam.x, cy = projY(x1, y1, 0) - cam.y;   // front corner
  const dx = projX(x0, y1) - cam.x, dy = projY(x0, y1, 0) - cam.y;   // left corner
  const edge = 'rgba(0,0,0,0.35)';
  poly([[dx, dy - z0], [cx, cy - z0], [cx, cy - z1], [dx, dy - z1]], cLeft, edge);
  poly([[cx, cy - z0], [bx, by - z0], [bx, by - z1], [cx, cy - z1]], cRight, edge);
  poly([[ax, ay - z1], [bx, by - z1], [cx, cy - z1], [dx, dy - z1]], cTop, edge);
}
function isoCyl(x, y, rad, z0, z1, cTop, cSide) {
  const sx = projX(x, y) - cam.x, sy = projY(x, y, 0) - cam.y;
  const rx = rad * 1.414 / TS * HW, ry = rad * 1.414 / TS * HH;
  ctx.fillStyle = cSide;
  ctx.fillRect(sx - rx, sy - z1, rx * 2, z1 - z0);
  ctx.beginPath(); ctx.ellipse(sx, sy - z0, rx, ry, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = cTop; ctx.beginPath(); ctx.ellipse(sx, sy - z1, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
}
function shadow(x, y, rad) {
  const sx = projX(x, y) - cam.x, sy = projY(x, y, 0) - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath(); ctx.ellipse(sx, sy, rad * 1.6 / TS * HW, rad * 1.6 / TS * HH, 0, 0, Math.PI * 2); ctx.fill();
}
function groundEllipse(x, y, rad) {   // a world-space circle as seen in iso
  ctx.ellipse(projX(x, y) - cam.x, projY(x, y, 0) - cam.y, rad * 1.414 / TS * HW, rad * 1.414 / TS * HH, 0, 0, Math.PI * 2);
}

function drawEnemy(e, hov) {
  const s = e.T.sz, hs = s / 2, h = enemyH(e);
  let col = e.flash > 0 ? '#ffffff' : e.T.color;
  if (e.flash <= 0) { if (e.slow > 0) col = '#6fa8e8'; else if (e.pois) col = '#7ab83a'; }       // status tints
  shadow(e.x, e.y, hs);
  if (hov) {
    ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 2; ctx.beginPath(); groundEllipse(e.x, e.y, hs + 4); ctx.stroke();
  }
  if (e.T.ranged) isoCyl(e.x, e.y, hs, 0, h, shade(col, 1.25), shade(col, 0.8));
  else isoBox(e.x - hs, e.y - hs, e.x + hs, e.y + hs, 0, h, shade(col, 1.25), shade(col, 0.7), shade(col, 0.95));
  // eyes on the front-left face
  const ex = projX(e.x, e.y + hs) - cam.x, ey = projY(e.x, e.y + hs, h * 0.7) - cam.y;
  ctx.fillStyle = '#ffe14d';
  ctx.fillRect(ex - hs * 0.9, ey - hs * 0.2, 3, 3); ctx.fillRect(ex - hs * 0.3, ey + hs * 0.1, 3, 3);
  if (e.boss) {
    ctx.fillStyle = '#ffd93b';
    for (let k = -1; k <= 1; k++) isoBox(e.x + k * 10 - 3, e.y - k * 10 - 3, e.x + k * 10 + 3, e.y - k * 10 + 3, h, h + 9, '#ffe680', '#b8941f', '#e0b52a');
  }
  if (e.hp < e.maxhp || hov) {
    const sx = projX(e.x, e.y) - cam.x, sy = projY(e.x, e.y, h + (e.boss ? 20 : 10)) - cam.y, bw = Math.max(28, s * 1.3);
    ctx.fillStyle = '#000'; ctx.fillRect(sx - bw / 2 - 1, sy - 1, bw + 2, 6);
    ctx.fillStyle = '#d02020'; ctx.fillRect(sx - bw / 2, sy, bw * Math.max(0, e.hp / e.maxhp), 4);
  }
}

function drawPlayer() {
  const c = cls();
  shadow(P.x, P.y, 10);
  let body = c.color;
  if (P.armor && P.armor.rar > 0) body = RARITY_COLOR[P.armor.rar];
  if (P.flash > 0) body = '#ff9a9a';
  if (P.buffs.evade > 0) ctx.globalAlpha = 0.55;
  isoCyl(P.x, P.y, 9, 0, 24, shade(body, 1.2), shade(body, 0.85));
  isoBox(P.x - 5, P.y - 5, P.x + 5, P.y + 5, 24, 33, '#f6e0c0', '#c9a97f', '#e2c49a');
  const sx = projX(P.x, P.y) - cam.x, sy = projY(P.x, P.y, 0) - cam.y;
  if (P.cls === 'warrior') isoBox(P.x - 6, P.y - 6, P.x + 6, P.y + 6, 31, 36, '#c3cadb', '#7d8599', '#9aa3b8');                     // helmet
  else if (P.cls === 'mage') { poly([[sx - 9, sy - 33], [sx + 9, sy - 33], [sx, sy - 56]], '#3a2f80', 'rgba(0,0,0,0.4)'); }          // pointed hat
  else isoBox(P.x - 6, P.y - 6, P.x + 6, P.y + 6, 29, 37, '#24402f', '#16281d', '#1f3627');                                        // hood
  if (P.buffs.warcry > 0) { ctx.strokeStyle = 'rgba(255,150,60,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); groundEllipse(P.x, P.y, 16); ctx.stroke(); }
  if (P.buffs.shadow) { ctx.strokeStyle = 'rgba(160,110,230,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); groundEllipse(P.x, P.y, 14); ctx.stroke(); }
  // held item: warrior's sword swings, mage's staff, rogue's dagger
  const a = P.face + (P.swing > 0 ? (P.swing / 0.15 - 0.5) * 1.6 : 0);
  const wc = P.cls === 'warrior' ? (P.weapon ? RARITY_COLOR[P.weapon.rar] : '#ddd') : P.cls === 'mage' ? '#8a5a2a' : '#e6e6e6';
  const len = P.cls === 'mage' ? 30 : P.cls === 'rogue' ? 18 : 26;
  ctx.strokeStyle = wc; ctx.lineWidth = P.cls === 'rogue' ? 3 : 4; ctx.beginPath();
  ctx.moveTo(projX(P.x + Math.cos(a) * 8, P.y + Math.sin(a) * 8) - cam.x, projY(P.x + Math.cos(a) * 8, P.y + Math.sin(a) * 8, 16) - cam.y);
  const tx = P.x + Math.cos(a) * len, ty = P.y + Math.sin(a) * len;
  ctx.lineTo(projX(tx, ty) - cam.x, projY(tx, ty, 16) - cam.y); ctx.stroke();
  if (P.cls === 'mage') { ctx.fillStyle = '#b48cff'; ctx.fillRect(projX(tx, ty) - cam.x - 3, projY(tx, ty, 16) - cam.y - 3, 6, 6); }
  ctx.globalAlpha = 1;
}

function drawGroundItem(g, hoverG) {
  const bob = 4 + Math.sin(time * 3 + g.t) * 2, sx = projX(g.x, g.y) - cam.x, sy = projY(g.x, g.y, 0) - cam.y;
  shadow(g.x, g.y, 7);
  let label = null, lc = '#fff';
  if (g.kind === 'gold') isoBox(g.x - 5, g.y - 5, g.x + 5, g.y + 5, bob, bob + 5, '#ffe45c', '#b8900a', '#e0b11a');
  else if (g.kind === 'hp') { isoCyl(g.x, g.y, 5, bob, bob + 12, '#ff6a6a', '#b01c1c'); label = 'Health potion'; lc = '#ff9a9a'; }
  else if (g.kind === 'mp') { isoCyl(g.x, g.y, 5, bob, bob + 12, '#6a9aff', '#1c3fb0'); label = 'Mana potion'; lc = '#9ab8ff'; }
  else {
    const c = RARITY_COLOR[g.item.rar];
    isoBox(g.x - 8, g.y - 8, g.x + 8, g.y + 8, bob, bob + 10, shade(c, 1.1), shade(c, 0.6), shade(c, 0.85));
    if (g.item.rar > 0 || hoverG) { label = g.item.name; lc = c; }
  }
  if (g.kind === 'gold' && hoverG) label = g.amount + ' gold';
  if (label && (hoverG || g.kind === 'item')) text(label, sx, sy - bob - 20, lc, 11, 'center');
}

function drawProjectile(p) {
  shadow(p.x, p.y, p.r);
  const z = 12;
  isoBox(p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r, z, z + p.r * 2,
    shade(p.color, 1.3), shade(p.color, 0.7), shade(p.color, 1));
}

function drawEffect(f) {
  const k = f.t / f.dur;
  if (f.type === 'ring') {
    const r = f.r0 + (f.r1 - f.r0) * k;
    ctx.beginPath(); groundEllipse(f.x, f.y, r);
    ctx.fillStyle = 'rgba(' + f.color + ',' + 0.18 * (1 - k) + ')'; ctx.fill();
    ctx.strokeStyle = 'rgba(' + f.color + ',' + (1 - k) + ')'; ctx.lineWidth = 5 * (1 - k) + 2; ctx.stroke();
  } else if (f.type === 'marker') {                  // ground warning (meteor)
    const r = f.r * (0.4 + 0.6 * k);
    ctx.beginPath(); groundEllipse(f.x, f.y, f.r);
    ctx.strokeStyle = 'rgba(' + f.color + ',0.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); groundEllipse(f.x, f.y, r);
    ctx.fillStyle = 'rgba(' + f.color + ',' + (0.12 + 0.25 * k) + ')'; ctx.fill();
    ctx.strokeStyle = 'rgba(' + f.color + ',0.9)'; ctx.lineWidth = 3; ctx.stroke();
    const fy = projY(f.x, f.y, 260 * (1 - k)) - cam.y, fx = projX(f.x, f.y) - cam.x;   // the meteor itself, falling
    ctx.fillStyle = '#ff9a3a'; ctx.fillRect(fx - 9, fy - 9, 18, 18); ctx.fillStyle = '#ffd96a'; ctx.fillRect(fx - 4, fy - 4, 8, 8);
  } else if (f.type === 'bolt') {                    // lightning chain
    ctx.strokeStyle = 'rgba(250,240,110,' + (1 - k) + ')'; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath();
    f.pts.forEach((p, i) => {
      const x = projX(p.x, p.y) - cam.x, y = projY(p.x, p.y, 16) - cam.y;
      if (i) { const q = f.pts[i - 1], qx = projX(q.x, q.y) - cam.x, qy = projY(q.x, q.y, 16) - cam.y;
               ctx.lineTo((x + qx) / 2 + ((i * 37) % 11) - 5, (y + qy) / 2 + ((i * 53) % 11) - 5); ctx.lineTo(x, y); }
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
  } else if (f.type === 'slash') {
    ctx.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')'; ctx.lineWidth = 3; ctx.beginPath();
    const rad = f.rad || 30, half = f.half || 0.9;
    for (let a = f.a - half, n = 0; a <= f.a + half; a += 0.15, n++) {
      const wx = f.x + Math.cos(a) * rad, wy = f.y + Math.sin(a) * rad;
      const sx = projX(wx, wy) - cam.x, sy = projY(wx, wy, 14) - cam.y;
      if (n) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
    }
    ctx.stroke();
  }
}

function drawExitTile(e, cx, cy) {
  const locked = e.locked, sealed = e.needBoss && enemies.some(b => b.boss && !b.dead);
  const pal = locked || sealed ? ['#6b1f1f', '#a03030'] : e.kind === 'up' ? ['#1f4f8a', '#4a8ae0'] : e.kind === 'road' ? ['#8a6a1f', '#e0b040']
            : e.kind === 'portal' ? ['#5a2a8a', '#b070f0'] : e.kind === 'tp' ? ['#1a6a7a', '#40e0f0'] : ['#1d7a3c', '#33c26a'];
  for (let k = 0; k < 4; k++) {
    const f = 1 - k * 0.22;
    poly([[cx, cy - HH * f + k * 2], [cx + HW * f, cy + k * 2], [cx, cy + HH * f + k * 2], [cx - HW * f, cy + k * 2]], k & 1 ? pal[1] : pal[0]);
  }
  if (locked) {                                           // gate bars
    ctx.strokeStyle = '#d04040'; ctx.lineWidth = 3; ctx.beginPath();
    for (let k = -2; k <= 2; k++) { ctx.moveTo(cx + k * 9, cy - 22); ctx.lineTo(cx + k * 9, cy + 4); }
    ctx.stroke();
  }
}

function drawWorld() {
  const ptx = Math.floor(P.x / TS), pty = Math.floor(P.y / TS);
  const draws = [];            // depth-sorted drawables: key = u + v (i.e. (x+y)/TS)
  const th = theme();

  // pass 1: flat floor diamonds, collect wall blocks
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    const idx = j * MW + i;
    if (!explored[idx]) continue;
    const cx = projX((i + 0.5) * TS, (j + 0.5) * TS) - cam.x, cy = projY((i + 0.5) * TS, (j + 0.5) * TS, 0) - cam.y;
    if (cx < -HW - 2 || cx > W + HW + 2 || cy < -HH - WALL_H - 2 || cy > H + HH + 2) continue;
    const t = map[idx];
    if (t === 1) { if (wallVis[idx]) draws.push({ k: i + j + 1, t: 0, i, j, cx, cy }); continue; }
    const h = ((i * 73856093) ^ (j * 19349663)) & 7;
    const pal = floorTint && floorTint[idx] ? th.alt : th.floor;
    poly([[cx, cy - HH], [cx + HW, cy], [cx, cy + HH], [cx - HW, cy]], pal[(i + j) & 1], 'rgba(0,0,0,0.18)');
    if (h === 0 && !isTown()) poly([[cx - 8, cy], [cx, cy - 4], [cx + 8, cy], [cx, cy + 4]], 'rgba(0,0,0,0.14)');
    if (t === 2 || t === 3) { const ex = exitAt(i, j); if (ex) drawExitTile(ex, cx, cy); }
  }
  for (const f of effects) drawEffect(f);

  // collect entities
  const showHover = !P.dead && !invOpen && !(mouse.touch && !mouse.down);
  const hov = showHover ? enemyAt(mouse.x, mouse.y) : null;
  const hovG = showHover ? groundAt(mouse.x, mouse.y) : null;
  const hovN = showHover && !mouse.touch ? npcAt(mouse.x, mouse.y) : null;
  const onScreen = (x, y) => { const sx = projX(x, y) - cam.x, sy = projY(x, y, 0) - cam.y; return sx > -80 && sx < W + 80 && sy > -120 && sy < H + 80; };
  for (const g of ground) if (onScreen(g.x, g.y)) draws.push({ k: (g.x + g.y) / TS, t: 1, o: g });
  for (const e of enemies) {
    if (!onScreen(e.x, e.y) || !explored[Math.floor(e.y / TS) * MW + Math.floor(e.x / TS)]) continue;
    draws.push({ k: (e.x + e.y) / TS, t: 2, o: e });
  }
  for (const p of projectiles) if (onScreen(p.x, p.y)) draws.push({ k: (p.x + p.y) / TS, t: 3, o: p });
  for (const n of npcs) if (onScreen(n.x, n.y)) draws.push({ k: (n.x + n.y) / TS, t: 5, o: n });
  draws.push({ k: (P.x + P.y) / TS, t: 4 });
  draws.sort((a, b) => a.k - b.k);

  const pk = ptx + pty + 1;
  for (const d of draws) {
    if (d.t === 0) {                                   // wall block
      const x0 = d.i * TS, y0 = d.j * TS, wi = wallTint ? wallTint[d.j * MW + d.i] : 0, wp = th.walls[wi] || th.walls[0], wh = wp.h || WALL_H;
      const front = d.i >= ptx && d.j >= pty && d.k > pk && d.i - ptx <= 4 && d.j - pty <= 4 && wh > 20;   // would hide the player
      if (front) ctx.globalAlpha = 0.35;
      isoBox(x0, y0, x0 + TS, y0 + TS, 0, wh, wp.top, wp.l, wp.r);
      ctx.globalAlpha = 1;
    } else if (d.t === 1) drawGroundItem(d.o, d.o === hovG);
    else if (d.t === 2) drawEnemy(d.o, d.o === hov);
    else if (d.t === 3) drawProjectile(d.o);
    else if (d.t === 5) drawNpc(d.o, d.o === hovN);
    else drawPlayer();
  }
  // exit labels
  for (const e of exits) {
    const wx = (e.tx + 0.5) * TS, wy = (e.ty + 0.5) * TS;
    if (!explored[e.ty * MW + e.tx] || !onScreen(wx, wy)) continue;
    const locked = e.locked, sealed = e.needBoss && enemies.some(b => b.boss && !b.dead);
    let lab = exitLabel(e), col = '#cfeccf';
    const tz = WORLD[e.to];
    if (tz && tz.recLevel && e.to !== zoneId && tz.type === 'dungeon' && e.kind === 'dungeon') lab += '  (Lv ' + tz.recLevel + '+)';
    if (locked) { lab += '  [LOCKED]'; col = '#ff9a9a'; } else if (sealed) { lab += '  [SEALED]'; col = '#ff9a9a'; }
    text(lab, projX(wx, wy) - cam.x, projY(wx, wy, 0) - cam.y - (locked ? 34 : 24), col, 12, 'center');
  }
  // floating texts (always on top)
  for (const t of texts) {
    ctx.globalAlpha = clamp(2 * (1 - t.t / t.dur), 0, 1);
    text(t.s, projX(t.x, t.y) - cam.x, projY(t.x, t.y, 40 + t.dz) - cam.y, t.color, Math.round(t.size * Math.max(1, 0.9 / VZ)), 'center');
  }
  ctx.globalAlpha = 1;
}
