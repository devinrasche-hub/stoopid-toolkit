/* Museum copy only. Stickblade's real build connects through PeerJS; the museum
 * can't reach the internet, so this stand-in opens the room locally. You can
 * walk around. Nobody else can join. That's the exhibit. */
(function () {
  try {
    const rs = history.replaceState.bind(history);
    history.replaceState = function () { try { return rs.apply(null, arguments); } catch (e) {} };
  } catch (e) {}
  class Peer {
    constructor(id) {
      this.id = id || 'museum-visitor-' + ((Math.random() * 1e6) | 0);
      this.h = {};
      setTimeout(() => this.emit('open', this.id), 350);
    }
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; }
    emit(e, ...a) { (this.h[e] || []).forEach((f) => f(...a)); }
    connect() {
      const c = { open: false, peer: 'nobody', on() { return c; }, send() {}, close() {} };
      setTimeout(() => this.emit('error', { type: 'peer-unavailable' }), 600);
      return c;
    }
  }
  window.Peer = Peer;
})();
