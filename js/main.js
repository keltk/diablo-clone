'use strict';
// Fixed-timestep main loop and startup.
// Plain script (no modules): shares globals with the other files in js/.

// ===================================================================
//  MAIN LOOP (fixed timestep)
// ===================================================================
let last = 0, acc = 0;
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000); last = now;
  while (acc >= DT) { update(DT); acc -= DT; }
  render();
  requestAnimationFrame(frame);
}

mmCanvas = document.createElement('canvas'); mmCanvas.width = MW * 2; mmCanvas.height = MH * 2;
resize();
newRun();
update(0);
requestAnimationFrame(t => { last = t; frame(t); });

// test/debug hook (harmless)
window.__game = { update, render, get state() { return { P, enemies, ground, depth, map, rooms, stairs, mouse, HUD, PANEL, VZ, W, H, invOpen, paused, newRun, pressButton, buildLevel, genItem, findPath }; } };
