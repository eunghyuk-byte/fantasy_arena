/* v0.331 FantasySoul server client (accounts + decks). Offline-safe: every call fails soft,
 * and the game keeps using localStorage decks when no server answers. */
(function () {
  const TOKEN_KEY = "fs-auth-token";
  const URL_KEY = "fs-server-url"; // optional override, e.g. http://1.2.3.4:8787
  const DEFAULT_URL = "http://localhost:8787";
  const S = { base: null, available: false, token: null, account: null, maxDecks: 10, devLogin: true, probed: false };
  try { S.token = localStorage.getItem(TOKEN_KEY) || null; } catch (e) {}

  function candidates() {
    const out = [];
    try { const o = localStorage.getItem(URL_KEY); if (o) return [o.replace(/\/+$/, "")]; } catch (e) {}
    if (window.FS_SERVER_URL) out.push(String(window.FS_SERVER_URL).replace(/\/+$/, ""));
    if (/^https?:$/.test(location.protocol)) out.push(location.origin);
    out.push(DEFAULT_URL);
    return [...new Set(out)];
  }
  function withTimeout(ms) {
    const c = new AbortController();
    setTimeout(() => c.abort(), ms);
    return c.signal;
  }
  async function probe() {
    for (const b of candidates()) {
      try {
        const r = await fetch(b + "/api/health", { signal: withTimeout(1500) });
        if (!r.ok) continue;
        const j = await r.json();
        if (j && j.service === "fantasysoul") {
          S.base = b; S.available = true; S.maxDecks = j.maxDecks || 10; S.devLogin = !!j.devLogin;
          break;
        }
      } catch (e) {}
    }
    S.probed = true;
    if (S.available && S.token) {
      const me = await call("GET", "/api/me");
      if (me.ok) S.account = me.account; else setToken(null);
    }
    return S.available;
  }
  function setToken(t) {
    S.token = t;
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    if (!t) S.account = null;
  }
  async function call(method, path, body) {
    if (!S.available) return { ok: false, error: "offline", message: "서버에 연결되지 않았습니다." };
    try {
      const r = await fetch(S.base + path, {
        method,
        headers: Object.assign({ "Content-Type": "application/json" }, S.token ? { Authorization: "Bearer " + S.token } : {}),
        body: body ? JSON.stringify(body) : undefined,
        signal: withTimeout(8000),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 && path !== "/api/auth/dev") setToken(null);
      return Object.assign({ status: r.status }, j, { ok: r.ok && j.ok !== false });
    } catch (e) {
      return { ok: false, error: "network", message: "서버와 통신하지 못했습니다." };
    }
  }
  async function devLogin(name) {
    const r = await call("POST", "/api/auth/dev", { name });
    if (r.ok) { setToken(r.token); S.account = r.account; }
    return r;
  }
  async function logout() {
    if (S.token) await call("POST", "/api/auth/logout");
    setToken(null);
  }
  window.FSNet = {
    state: S,
    probe,
    isOnline: () => S.available,
    isLoggedIn: () => !!(S.available && S.token && S.account),
    account: () => S.account,
    devLogin,
    logout,
    listDecks: () => call("GET", "/api/decks"),
    createDeck: (d) => call("POST", "/api/decks", d),
    updateDeck: (id, patch) => call("PATCH", "/api/decks/" + id, patch),
    renameDeck: (id, name) => call("PATCH", "/api/decks/" + id, { name }),
    deleteDeck: (id) => call("DELETE", "/api/decks/" + id),
  };
})();
