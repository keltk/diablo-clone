'use strict';
// Dungeon generation, collision, line-of-sight and A* pathfinding.
// Plain script (no modules): shares globals with the other files in js/.

// ===================================================================
//  DUNGEON GENERATION
// ===================================================================
function generateDungeon() {
  map = new Uint8Array(MW * MH).fill(1);
  explored = new Uint8Array(MW * MH);
  rooms = [];
  for (let tries = 0; tries < 200 && rooms.length < 12; tries++) {
    const w = ri(5, 11), h = ri(5, 9);
    const x = ri(2, MW - w - 3), y = ri(2, MH - h - 3);
    let ok = true;
    for (const r of rooms) {
      if (x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y) { ok = false; break; }
    }
    if (!ok) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  for (const r of rooms) for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) map[j * MW + i] = 0;
  for (let i = 1; i < rooms.length; i++) carveCorridor(rooms[i - 1], rooms[i]);
  for (let i = 0; i < 3 && rooms.length > 3; i++) carveCorridor(pick(rooms), pick(rooms)); // loops
  // stairs in the room farthest from the start
  let far = rooms[0];
  for (const r of rooms) if (dist(r.cx, r.cy, rooms[0].cx, rooms[0].cy) > dist(far.cx, far.cy, rooms[0].cx, rooms[0].cy)) far = r;
  far.stairs = true;
  stairs = { tx: far.cx, ty: far.cy };
  map[stairs.ty * MW + stairs.tx] = 2;
  wallVis = new Uint8Array(MW * MH);       // walls adjacent to open floor (others are never visible)
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    if (map[j * MW + i] !== 1) continue;
    for (let dj = -1; dj <= 1 && !wallVis[j * MW + i]; dj++) for (let di = -1; di <= 1; di++) {
      const x = i + di, y = j + dj;
      if (x >= 0 && y >= 0 && x < MW && y < MH && map[y * MW + x] !== 1) { wallVis[j * MW + i] = 1; break; }
    }
  }
}

function carveCorridor(a, b) {
  let x = a.cx, y = a.cy;
  const horizFirst = rnd() < 0.5;
  const stepX = () => { while (x !== b.cx) { map[y * MW + x] = 0; map[(y + 1) * MW + x] = 0; x += Math.sign(b.cx - x); } };
  const stepY = () => { while (y !== b.cy) { map[y * MW + x] = 0; map[y * MW + x + 1] = 0; y += Math.sign(b.cy - y); } };
  if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
  map[y * MW + x] = 0; map[(y + 1) * MW + x] = 0; map[y * MW + x + 1] = 0;
}

// ===================================================================
//  COLLISION, LINE-OF-SIGHT, PATHFINDING
// ===================================================================
function solid(px, py) {
  const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
  if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true;
  return map[ty * MW + tx] === 1;
}
const blocked = (x, y, r) => solid(x - r, y - r) || solid(x + r, y - r) || solid(x - r, y + r) || solid(x + r, y + r);
function moveEnt(e, dx, dy) {          // axis-separated => wall sliding
  if (!blocked(e.x + dx, e.y, e.r)) e.x += dx;
  if (!blocked(e.x, e.y + dy, e.r)) e.y += dy;
}
function clearLine(ax, ay, bx, by, r) {
  const d = dist(ax, ay, bx, by), n = Math.ceil(d / 6);
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    if (blocked(ax + (bx - ax) * t, ay + (by - ay) * t, r)) return false;
  }
  return true;
}
const walkable = (tx, ty) => tx >= 0 && ty >= 0 && tx < MW && ty < MH && map[ty * MW + tx] !== 1;

// tiny binary heap keyed on f
class Heap {
  constructor() { this.a = []; }
  push(f, v) {
    const a = this.a; a.push([f, v]); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        let l = 2 * i + 1, r = l + 1, m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Grid A* (8-dir, no corner cutting). If goal is unreachable, heads to the closest tile reached.
function findPath(sx, sy, gx, gy, r) {
  const stx = clamp(Math.floor(sx / TS), 0, MW - 1), sty = clamp(Math.floor(sy / TS), 0, MH - 1);
  const gtx = clamp(Math.floor(gx / TS), 0, MW - 1), gty = clamp(Math.floor(gy / TS), 0, MH - 1);
  const goalOk = walkable(gtx, gty);
  const start = sty * MW + stx;
  const g = new Float32Array(MW * MH).fill(1e9), parent = new Int32Array(MW * MH).fill(-1), closed = new Uint8Array(MW * MH);
  const hfn = (x, y) => { const dx = Math.abs(x - gtx), dy = Math.abs(y - gty); return dx + dy - 0.586 * Math.min(dx, dy); };
  const heap = new Heap(); g[start] = 0; heap.push(hfn(stx, sty), start);
  let best = start, bestH = hfn(stx, sty), found = -1;
  while (heap.size) {
    const cur = heap.pop()[1];
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % MW, cy = (cur / MW) | 0;
    if (cx === gtx && cy === gty) { found = cur; break; }
    const hh = hfn(cx, cy);
    if (hh < bestH) { bestH = hh; best = cur; }
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!walkable(nx, ny)) continue;
      if (dx && dy && (!walkable(cx + dx, cy) || !walkable(cx, cy + dy))) continue;
      const ni = ny * MW + nx;
      if (closed[ni]) continue;
      const ng = g[cur] + (dx && dy ? 1.414 : 1);
      if (ng < g[ni]) { g[ni] = ng; parent[ni] = cur; heap.push(ng + hfn(nx, ny), ni); }
    }
  }
  let end = found >= 0 ? found : best;
  const pts = [];
  for (let c = end; c !== start && c >= 0; c = parent[c]) pts.push({ x: (c % MW) * TS + TS / 2, y: ((c / MW) | 0) * TS + TS / 2 });
  pts.reverse();
  if (found >= 0 && goalOk && pts.length) pts[pts.length - 1] = { x: gx, y: gy };
  // string-pulling: drop waypoints that can be skipped with a clear line
  const out = []; let cx = sx, cy = sy, i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !clearLine(cx, cy, pts[j].x, pts[j].y, r)) j--;
    out.push(pts[j]); cx = pts[j].x; cy = pts[j].y; i = j + 1;
  }
  return out;
}
function pathTo(e, x, y) {
  if (clearLine(e.x, e.y, x, y, e.r)) return [{ x, y }];
  return findPath(e.x, e.y, x, y, e.r);
}
function followPath(e, path, speed, dt) {   // returns true if moved
  if (!path.length) return false;
  const wp = path[0], d = dist(e.x, e.y, wp.x, wp.y), step = speed * dt;
  if (d <= step) { moveEnt(e, wp.x - e.x, wp.y - e.y); path.shift(); return true; }
  const ox = e.x, oy = e.y;
  moveEnt(e, (wp.x - e.x) / d * step, (wp.y - e.y) / d * step);
  if (Math.abs(e.x - ox) + Math.abs(e.y - oy) < 0.01) path.shift(); // stuck against a wall: give up this waypoint
  return true;
}
