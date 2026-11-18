/* Stickblade — deterministic simulation (shared by host and clients).
 *
 * This file is the ONLY place movement physics lives. Host and every client
 * load the identical code, so applying the same input command yields the same
 * position everywhere — the foundation that makes client-side prediction and
 * host reconciliation agree instead of rubber-banding.
 *
 * Top-down arena: WASD moves in 8 directions on a plane (no gravity/jump).
 * `aim` is the client-reported facing angle (radians) toward the cursor.
 */
const Sim = (() => {
  const TICK_HZ = 30;
  const DT      = 1 / TICK_HZ;   // fixed timestep — same on host and client
  const SPEED   = 260;           // px/second
  const RADIUS  = 14;            // player collision radius

  const W = 960, H = 540;        // world == canvas pixels (no camera transform)
  const WALL = 24;               // wall thickness / play-area inset

  // Play area, already shrunk by the player radius so clamping is exact.
  const BOUNDS = {
    minX: WALL + RADIUS, minY: WALL + RADIUS,
    maxX: W - WALL - RADIUS, maxY: H - WALL - RADIUS,
  };

  // Four pillars for cover (AABBs), symmetric about the arena center.
  const PW = 64, PH = 64;
  const pillars = [
    { x: 240 - PW / 2, y: 150 - PH / 2, w: PW, h: PH },
    { x: 720 - PW / 2, y: 150 - PH / 2, w: PW, h: PH },
    { x: 240 - PW / 2, y: 390 - PH / 2, w: PW, h: PH },
    { x: 720 - PW / 2, y: 390 - PH / 2, w: PW, h: PH },
  ];

  // Spawn points, spread so figures don't overlap on join.
  const SPAWNS = [
    { x: 120, y: 120 }, { x: 840, y: 420 }, { x: 840, y: 120 },
    { x: 120, y: 420 }, { x: 480, y: 90 },  { x: 480, y: 450 },
  ];
  function spawnPoint(i) { return SPAWNS[i % SPAWNS.length]; }

  // Apply ONE input command to an entity for exactly one tick. Deterministic:
  // no reference to wall-clock time or randomness.
  function step(e, cmd) {
    const dx = cmd.dx, dy = cmd.dy;
    if (dx || dy) {
      const inv = 1 / Math.hypot(dx, dy); // normalize so diagonals aren't faster
      e.x += dx * inv * SPEED * DT;
      e.y += dy * inv * SPEED * DT;
    }
    e.aim = cmd.aim;
    collide(e);
  }

  // Resolve the player circle against arena bounds and pillar rectangles.
  function collide(e) {
    if (e.x < BOUNDS.minX) e.x = BOUNDS.minX;
    else if (e.x > BOUNDS.maxX) e.x = BOUNDS.maxX;
    if (e.y < BOUNDS.minY) e.y = BOUNDS.minY;
    else if (e.y > BOUNDS.maxY) e.y = BOUNDS.maxY;

    for (const p of pillars) {
      // Closest point on the rectangle to the circle center.
      const nx = Math.max(p.x, Math.min(e.x, p.x + p.w));
      const ny = Math.max(p.y, Math.min(e.y, p.y + p.h));
      const ddx = e.x - nx, ddy = e.y - ny;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < RADIUS * RADIUS) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          e.x = nx + (ddx / d) * RADIUS;
          e.y = ny + (ddy / d) * RADIUS;
        } else {
          // Center is inside the rectangle: eject along the shallowest axis.
          const left = e.x - p.x, right = p.x + p.w - e.x;
          const top = e.y - p.y, bottom = p.y + p.h - e.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) e.x = p.x - RADIUS;
          else if (m === right) e.x = p.x + p.w + RADIUS;
          else if (m === top) e.y = p.y - RADIUS;
          else e.y = p.y + p.h + RADIUS;
        }
      }
    }
  }

  return { TICK_HZ, DT, SPEED, RADIUS, W, H, WALL, BOUNDS, pillars, spawnPoint, step, collide };
})();
