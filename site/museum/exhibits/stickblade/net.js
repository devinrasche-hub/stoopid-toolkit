/* Stickblade — connection layer (Step 1).
 *
 * Role is decided by the URL:
 *   no ?r=slug  -> you are creating a room. You become the HOST. We mint a
 *                  slug, claim it as our PeerJS id, and rewrite the URL so it
 *                  can be shared.
 *   ?r=slug     -> you are joining. You become a CLIENT and connect to the
 *                  host whose PeerJS id IS that slug.
 *
 * The host is the sole authority — even the player count is computed here and
 * broadcast down. Clients never tally peers themselves. Later steps (movement,
 * swords, combat) ride on the same send()/broadcast() channel.
 */
const Net = (() => {
  const HEARTBEAT_MS = 1000;   // how often each side pings
  const TIMEOUT_MS   = 4000;   // silence past this = peer is gone

  const state = {
    isHost: false,
    roomId: null,
    myId: null,
    peer: null,

    // Host side: clientId -> { conn, lastSeen, name }
    clients: new Map(),
    // Client side: the single connection up to the host.
    hostConn: null,
    hostLastSeen: 0,

    playerCount: 0,   // authoritative on host, mirrored on client
    status: 'init',   // init | connecting | live | host-gone | error

    // Callbacks set by main.js.
    onChange: () => {},        // (state) => void, fired whenever anything moves
    onMessage: () => {},       // (fromId, type, payload) => void, game data hook
  };

  // ---- slug generation ---------------------------------------------------
  const ADJ  = ['blue','red','gold','grey','lone','swift','iron','pale','wild','calm'];
  const NOUN = ['fox','wolf','hawk','bear','crow','lynx','stag','pike','boar','moth'];
  function makeSlug() {
    const a = ADJ[(Math.random() * ADJ.length) | 0];
    const n = NOUN[(Math.random() * NOUN.length) | 0];
    const d = 10 + ((Math.random() * 90) | 0);
    return `${a}-${n}-${d}`;
  }

  function fire() { state.onChange(state); }

  // ---- startup -----------------------------------------------------------
  function start() {
    const params = new URLSearchParams(location.search);
    const slug = params.get('r');

    if (slug) {
      startClient(slug);
    } else {
      startHost();
    }

    setInterval(tick, HEARTBEAT_MS);
  }

  // ---- host --------------------------------------------------------------
  function startHost() {
    state.isHost = true;
    state.roomId = makeSlug();
    state.status = 'connecting';

    // Reflect the room in the URL so it becomes a shareable invite.
    const url = new URL(location.href);
    url.searchParams.set('r', state.roomId);
    history.replaceState(null, '', url);
    fire();

    // Claim the slug as our PeerJS id so clients can find us by slug alone.
    state.peer = new Peer(state.roomId);

    state.peer.on('open', (id) => {
      state.myId = id;
      state.status = 'live';
      recount();
    });

    state.peer.on('connection', (conn) => {
      conn.on('open', () => {
        state.clients.set(conn.peer, { conn, lastSeen: now() });
        recount();
        // Immediately tell the newcomer the current count.
        sendTo(conn, 'count', { n: state.playerCount });
      });
      conn.on('data', (msg) => onHostData(conn.peer, msg));
      conn.on('close', () => {
        state.clients.delete(conn.peer);
        recount();
      });
      conn.on('error', () => {
        state.clients.delete(conn.peer);
        recount();
      });
    });

    state.peer.on('error', (err) => {
      // The only fatal host error at this stage is the slug already being
      // taken (astronomically unlikely with random slugs). Surface it.
      console.error('[net] host peer error:', err.type || err);
      if (err.type === 'unavailable-id') {
        state.status = 'error';
        fire();
      }
    });
  }

  function onHostData(fromId, msg) {
    const c = state.clients.get(fromId);
    if (c) c.lastSeen = now();
    if (!msg || typeof msg !== 'object') return;

    if (msg.t === 'hb') {
      // Heartbeat: liveness only, already stamped above.
      return;
    }
    // Everything else is game data for later steps.
    state.onMessage(fromId, msg.t, msg.p);
  }

  // Host authority: (re)compute the player count and push it to everyone.
  function recount() {
    const n = 1 + state.clients.size; // host + connected clients
    state.playerCount = n;
    broadcast('count', { n });
    fire();
  }

  // ---- client ------------------------------------------------------------
  function startClient(slug) {
    state.isHost = false;
    state.roomId = slug;
    state.status = 'connecting';
    fire();

    state.peer = new Peer(); // random id; we only need to reach the host

    state.peer.on('open', (id) => {
      state.myId = id;
      const conn = state.peer.connect(slug, { reliable: true });
      state.hostConn = conn;

      conn.on('open', () => {
        state.hostLastSeen = now();
        state.status = 'live';
        fire();
      });
      conn.on('data', (msg) => onClientData(msg));
      conn.on('close', () => hostGone());
      conn.on('error', () => hostGone());
    });

    state.peer.on('error', (err) => {
      // Can't reach the host (bad/expired slug) => treat as host gone.
      console.error('[net] client peer error:', err.type || err);
      hostGone();
    });
  }

  function onClientData(msg) {
    state.hostLastSeen = now();
    if (!msg || typeof msg !== 'object') return;

    if (msg.t === 'hb') return;              // heartbeat
    if (msg.t === 'count') {                 // authoritative player count
      state.playerCount = msg.p.n;
      fire();
      return;
    }
    // Everything else is game data for later steps.
    state.onMessage(state.roomId, msg.t, msg.p);
  }

  function hostGone() {
    if (state.status === 'host-gone') return;
    state.status = 'host-gone';
    state.playerCount = 0;
    fire();
  }

  // ---- heartbeat / reaping ----------------------------------------------
  function tick() {
    const t = now();

    if (state.isHost) {
      // Ping every client, reap the silent ones.
      let changed = false;
      for (const [id, c] of state.clients) {
        if (t - c.lastSeen > TIMEOUT_MS) {
          try { c.conn.close(); } catch (_) {}
          state.clients.delete(id);
          changed = true;
        } else {
          sendTo(c.conn, 'hb', {});
        }
      }
      if (changed) recount();
    } else if (state.hostConn && state.status === 'live') {
      if (t - state.hostLastSeen > TIMEOUT_MS) {
        hostGone();
      } else {
        sendTo(state.hostConn, 'hb', {});
      }
    }
  }

  // ---- send helpers (reused by every later step) -------------------------
  function sendTo(conn, t, p) {
    if (conn && conn.open) {
      try { conn.send({ t, p }); } catch (_) {}
    }
  }
  // Client -> host.
  function send(t, p) { if (!state.isHost) sendTo(state.hostConn, t, p); }
  // Host -> every client.
  function broadcast(t, p) {
    if (!state.isHost) return;
    for (const { conn } of state.clients.values()) sendTo(conn, t, p);
  }

  function now() { return performance.now(); }

  return {
    start, send, broadcast, state,
    set onChange(fn) { state.onChange = fn; },
    set onMessage(fn) { state.onMessage = fn; },
  };
})();
