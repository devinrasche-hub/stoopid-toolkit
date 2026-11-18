/* Stickblade — Step 2: movement.
 *
 * Host authoritatively simulates every player at 30Hz and broadcasts world
 * snapshots. Clients send input only. Each client predicts its OWN figure
 * (instant response, reconciled against the host) and interpolates everyone
 * ELSE ~100ms in the past (smooth, no extrapolation).
 *
 * Net roles come from net.js; the deterministic physics from sim.js.
 */
(() => {
  // ---- DOM ---------------------------------------------------------------
  const roleEl = document.getElementById('role');
  const urlEl  = document.getElementById('url');
  const copyEl = document.getElementById('copy');
  const newEl  = document.getElementById('newroom');
  const canvas = document.getElementById('stage');
  const ctx    = canvas.getContext('2d');

  const PALETTE = ['#4ec5f2', '#f2c14e', '#7ef29b', '#f26d6d', '#c98cf2', '#f2a24e'];
  const color = (i) => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];

  // ---- input -------------------------------------------------------------
  const keys = { w: false, a: false, s: false, d: false };
  const mouse = { x: Sim.W / 2, y: Sim.H / 2 };

  const KEYMAP = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' };
  addEventListener('keydown', (e) => { if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); } });
  addEventListener('keyup',   (e) => { if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = false; e.preventDefault(); } });
  // Cursor position in canvas/world coordinates (handles any CSS scaling).
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top)  * (canvas.height / r.height);
  });

  // Build the current input command. `self` gives us the pivot for the aim
  // angle, so facing tracks the cursor even while standing still.
  function sampleInput(self) {
    const dx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    const dy = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
    const aim = self ? Math.atan2(mouse.y - self.y, mouse.x - self.x) : 0;
    return { dx, dy, aim };
  }

  // ---- shared render buffer ---------------------------------------------
  // Host fills this from its own ticks; clients fill it from received snaps.
  // Everyone renders OTHER players from it, delayed, for smoothness.
  const snapBuffer = [];   // [{ t, players: [{id,x,y,aim,c,seq}] }]
  const RENDER_DELAY = () => (Net.state.isHost ? 55 : 100); // ms

  function pushSnap(players) {
    const t = performance.now();
    snapBuffer.push({ t, players });
    const cutoff = t - 500;
    while (snapBuffer.length > 2 && snapBuffer[0].t < cutoff) snapBuffer.shift();
  }

  function lerpAngle(a, b, f) {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return a + d * f;
  }

  // Sample every player's position at `now - delay` by interpolating between
  // the two buffered snapshots that straddle that time.
  function sampleOthers() {
    const out = new Map();
    if (!snapBuffer.length) return out;
    const target = performance.now() - RENDER_DELAY();

    let a = null, b = null;
    for (let i = 0; i < snapBuffer.length - 1; i++) {
      if (snapBuffer[i].t <= target && snapBuffer[i + 1].t >= target) {
        a = snapBuffer[i]; b = snapBuffer[i + 1]; break;
      }
    }
    if (!a) { // target outside buffer: use the newest known state
      for (const p of snapBuffer[snapBuffer.length - 1].players)
        out.set(p.id, { x: p.x, y: p.y, aim: p.aim, c: p.c });
      return out;
    }
    const f = Math.max(0, Math.min(1, (target - a.t) / ((b.t - a.t) || 1)));
    const bmap = new Map(b.players.map((p) => [p.id, p]));
    for (const pa of a.players) {
      const pb = bmap.get(pa.id) || pa;
      out.set(pa.id, {
        x: pa.x + (pb.x - pa.x) * f,
        y: pa.y + (pb.y - pa.y) * f,
        aim: lerpAngle(pa.aim, pb.aim, f),
        c: pa.c,
      });
    }
    return out;
  }

  // ===================================================================== //
  //  HOST                                                                 //
  // ===================================================================== //
  const entities = new Map();  // id -> { x, y, aim, ci, lastSeq }
  const inbox = new Map();     // id -> pending input commands from that client
  let spawnCounter = 0;

  function addEntity(id) {
    const s = Sim.spawnPoint(spawnCounter);
    entities.set(id, { x: s.x, y: s.y, aim: 0, ci: spawnCounter, lastSeq: 0 });
    spawnCounter++;
  }

  // Keep the entity set in sync with who is actually connected.
  function syncRoster(me) {
    if (!entities.has(me)) addEntity(me);
    for (const id of Net.state.clients.keys()) if (!entities.has(id)) addEntity(id);
    for (const id of [...entities.keys()]) {
      if (id !== me && !Net.state.clients.has(id)) { entities.delete(id); inbox.delete(id); }
    }
  }

  function hostTick() {
    const me = Net.state.myId;
    if (Net.state.status !== 'live' || !me) return;
    syncRoster(me);

    // Host's own figure: local input, applied directly (zero latency, no net).
    const hostE = entities.get(me);
    Sim.step(hostE, sampleInput(hostE));

    // Each client's figure: apply every queued command in order.
    for (const [id, e] of entities) {
      if (id === me) continue;
      const q = inbox.get(id);
      if (q && q.length) {
        for (const cmd of q) { Sim.step(e, cmd); e.lastSeq = cmd.seq; }
        q.length = 0;
      }
    }

    // Broadcast the authoritative snapshot and buffer it for local rendering.
    const players = [];
    for (const [id, e] of entities) {
      players.push({ id, x: Math.round(e.x), y: Math.round(e.y),
                     aim: +e.aim.toFixed(3), c: e.ci, seq: e.lastSeq });
    }
    Net.broadcast('snap', { players });
    pushSnap(players);
  }

  // ===================================================================== //
  //  CLIENT                                                               //
  // ===================================================================== //
  let seqCounter = 0;
  let predicted = null;    // { x, y, aim } — our own figure
  const pending = [];      // unacknowledged input commands, for reconciliation

  function clientTick() {
    const me = Net.state.myId;
    if (Net.state.status !== 'live' || !me) return;

    const cmd = { seq: ++seqCounter, ...sampleInput(predicted) };
    if (predicted) Sim.step(predicted, cmd);   // predict immediately
    pending.push(cmd);
    if (pending.length > 300) pending.shift();
    Net.send('input', cmd);
  }

  function onSnap(p) {
    pushSnap(p.players);

    const me = Net.state.myId;
    const mine = p.players.find((pl) => pl.id === me);
    if (!mine) return;

    if (!predicted) {
      // First fix: adopt the host's spawn and discard any pre-join inputs.
      predicted = { x: mine.x, y: mine.y, aim: mine.aim };
      pending.length = 0;
      return;
    }
    // Reconcile: snap to authority, drop acked commands, replay the rest.
    predicted.x = mine.x; predicted.y = mine.y;
    while (pending.length && pending[0].seq <= mine.seq) pending.shift();
    for (const cmd of pending) Sim.step(predicted, cmd);
  }

  // ---- net wiring --------------------------------------------------------
  Net.onMessage = (fromId, type, payload) => {
    if (Net.state.isHost) {
      if (type === 'input') {
        let q = inbox.get(fromId);
        if (!q) inbox.set(fromId, (q = []));
        q.push(payload);
        if (q.length > 8) q.splice(0, q.length - 8); // cap backlog
      }
    } else if (type === 'snap') {
      onSnap(payload);
    }
  };

  Net.onChange = (s) => {
    roleEl.textContent = s.isHost ? 'HOST' : 'CLIENT';
    roleEl.className = 'role ' + (s.isHost ? 'host' : 'client');
    urlEl.value = location.href;
    newEl.style.display = (s.status === 'host-gone') ? '' : 'none';
  };

  copyEl.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(urlEl.value);
      copyEl.textContent = 'Copied!';
      setTimeout(() => (copyEl.textContent = 'Copy invite'), 1200);
    } catch (_) { urlEl.select(); }
  });
  // Known limit: no host migration. This just starts a brand-new room.
  newEl.addEventListener('click', () => { location.href = location.pathname; });

  Net.start();
  setInterval(() => { Net.state.isHost ? hostTick() : clientTick(); }, 1000 / Sim.TICK_HZ);

  // ===================================================================== //
  //  RENDER                                                               //
  // ===================================================================== //
  function drawArena() {
    ctx.fillStyle = '#0e1015';
    ctx.fillRect(0, 0, Sim.W, Sim.H);

    // floor
    ctx.fillStyle = '#161a22';
    ctx.fillRect(Sim.WALL, Sim.WALL, Sim.W - 2 * Sim.WALL, Sim.H - 2 * Sim.WALL);
    // walls
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2c313d';
    ctx.strokeRect(Sim.WALL, Sim.WALL, Sim.W - 2 * Sim.WALL, Sim.H - 2 * Sim.WALL);
    // pillars
    for (const p of Sim.pillars) {
      ctx.fillStyle = '#242a36';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#39414f';
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
  }

  function drawFighter(x, y, aim, col, isSelf) {
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + Sim.RADIUS * 0.7, Sim.RADIUS * 0.95, Sim.RADIUS * 0.45, 0, 0, 7);
    ctx.fill();
    // facing / sword arm indicator
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(aim) * (Sim.RADIUS + 12), y + Math.sin(aim) * (Sim.RADIUS + 12));
    ctx.stroke();
    // body
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, Sim.RADIUS, 0, 7);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isSelf ? '#ffffff' : '#0e1015';
    ctx.stroke();
    // head dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, Sim.RADIUS * 0.38, 0, 7);
    ctx.fill();
  }

  function render() {
    const s = Net.state;
    drawArena();

    if (s.status === 'host-gone') {
      overlay('Host left', 'The match has ended.');
    } else if (s.status === 'error') {
      overlay('Room unavailable', 'Reload to try again.');
    } else if (s.status !== 'live') {
      overlay('Connecting…', '');
    } else {
      const me = Net.state.myId;
      // Everyone else: interpolated, delayed.
      for (const [id, p] of sampleOthers()) {
        if (id === me) continue;
        drawFighter(p.x, p.y, p.aim, color(p.c), false);
      }
      // Self: crisp. Host draws authority; client draws prediction.
      if (s.isHost) {
        const e = entities.get(me);
        if (e) drawFighter(e.x, e.y, e.aim, color(e.ci), true);
      } else if (predicted) {
        drawFighter(predicted.x, predicted.y, predicted.aim, selfColor(), true);
      }
    }
    requestAnimationFrame(render);
  }

  // Our own color index arrives inside snapshots; look it up.
  function selfColor() {
    const me = Net.state.myId;
    if (snapBuffer.length) {
      const last = snapBuffer[snapBuffer.length - 1];
      const mine = last.players.find((pl) => pl.id === me);
      if (mine) return color(mine.c);
    }
    return color(0);
  }

  function overlay(title, sub) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8eaf0';
    ctx.font = '700 30px ui-monospace, monospace';
    ctx.fillText(title, Sim.W / 2, Sim.H / 2 - 14);
    if (sub) {
      ctx.fillStyle = '#9aa3b2';
      ctx.font = '16px ui-monospace, monospace';
      ctx.fillText(sub, Sim.W / 2, Sim.H / 2 + 22);
    }
  }

  requestAnimationFrame(render);

  // Debug accessor (test/inspection only; no game logic depends on it).
  window.Game = {
    get me() { return Net.state.myId; },
    get isHost() { return Net.state.isHost; },
    get entities() { return entities; },
    get predicted() { return predicted; },
    get pending() { return pending.length; },
    get snap() { return snapBuffer[snapBuffer.length - 1] || null; },
    setKey(k, v) { keys[k] = v; },
    _hostTick: hostTick,
    _clientTick: clientTick,
  };
})();
