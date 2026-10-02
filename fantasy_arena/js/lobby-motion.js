/* Continuous angular motion. Rendering and network state belong to lobby.js.
 * Analytic integration makes motion independent of frame rate and preserves
 * position/velocity when cancelling or starting again during deceleration. */
(function (root) {
  class SealMotion {
    constructor() { this.angle = 0; this.velocity = 0; this.target = 0; this.since = 0; this.duration = 0; this.phase = 'idle'; }
    sample(now) {
      const elapsed = Math.max(0, now - this.since);
      const t = this.duration ? Math.min(1, elapsed / this.duration) : 1;
      const smooth = t * t * (3 - 2 * t);
      const integral = t * t * t - .5 * t * t * t * t;
      const delta = this.target - this.velocity;
      return {
        angle: this.angle + (this.velocity * Math.min(elapsed, this.duration) + delta * this.duration * integral + this.target * Math.max(0, elapsed - this.duration)) / 1000,
        velocity: this.velocity + delta * smooth,
      };
    }
    transition(phase, now, reduced = false) {
      if (phase === this.phase && !reduced) return;
      const current = this.sample(now);
      this.angle = current.angle; this.velocity = reduced ? 0 : current.velocity;
      this.target = phase === 'searching' && !reduced ? 42 : 0;
      this.duration = reduced ? 0 : phase === 'searching' ? 1600 : phase === 'preview-stop' ? 1800 : phase === 'matched' ? 480 : 360;
      this.since = now; this.phase = phase;
    }
    freeze(now) {
      this.angle = this.sample(now).angle; this.velocity = this.target = this.duration = 0;
      this.since = now; this.phase = 'idle';
    }
  }
  const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];
  function rankProfile(account) {
    const p = account && account.rank;
    if (!p || !tiers.includes(p.tier) || !Number.isFinite(p.progress)) return null;
    const validDiv = d => Number.isInteger(d) && d >= 1 && d <= 10;
    if (!validDiv(p.div)) return null;
    const n = p.next;
    return { tier: p.tier, div: p.div, progress: Math.min(100, Math.max(0, p.progress)),
      next: n && tiers.includes(n.tier) && validDiv(n.div) ? {tier:n.tier, div:n.div} : null };
  }
  // Networking/retries remain owned by the account branch. Never delay battle.
  function roomCallbacks(setState, callbacks = {}) {
    return {
      onWaiting(room) { setState('searching'); callbacks.onWaiting?.(room); },
      onMatch(id) { setState('matched'); callbacks.onMatch?.(id); },
      onStatus(status) {
        const states = {connecting:'searching',cancelling:'cancelling',closed:'idle',disconnected:'disconnected',authRequired:'disconnected'};
        setState(states[status] || 'error'); callbacks.onStatus?.(status);
      },
    };
  }
  const api = { SealMotion, rankProfile, roomCallbacks };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LobbyMotion = api;
})(typeof window === 'undefined' ? globalThis : window);
