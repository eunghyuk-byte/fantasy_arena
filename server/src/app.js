"use strict";
const fs = require("fs");
const path = require("path");
const { validateDeck, normalizeName } = require("./deckRules");
const { issueSession, resolveSession } = require("./auth/sessions");
const { devLogin } = require("./auth/devAuth");
const { steamLogin } = require("./auth/steamAuth");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ogg": "audio/ogg",
  ".wav": "audio/wav", ".woff2": "font/woff2", ".ico": "image/x-icon",
};

function publicAccount(a) {
  return { id: a.id, displayName: a.displayName, steamLinked: !!a.steamId, dev: !!a.devName };
}

function createApp({ store, cards, config }) {
  function send(res, status, body) {
    const json = JSON.stringify(body);
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": config.corsOrigin,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Cache-Control": "no-store",
    });
    res.end(status === 204 ? undefined : json);
  }
  const fail = (res, status, code, message, extra) => send(res, status, { ok: false, error: code, message, ...(extra || {}) });

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on("data", c => { size += c.length; if (size > 64 * 1024) { reject(new Error("too_large")); req.destroy(); } else chunks.push(c); });
      req.on("end", () => {
        if (!chunks.length) return resolve({});
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (e) { reject(new Error("bad_json")); }
      });
      req.on("error", reject);
    });
  }

  async function auth(req) {
    const h = req.headers.authorization || "";
    const m = /^Bearer\s+([0-9a-f]{64})$/i.exec(h);
    return m ? resolveSession(store, m[1]) : null;
  }

  function serveStatic(req, res, pathname) {
    if (!config.staticDir) return false;
    let rel = decodeURIComponent(pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const root = path.resolve(config.staticDir);
    const file = path.resolve(root, "." + rel);
    if (!file.startsWith(root + path.sep)) return false;
    let st; try { st = fs.statSync(file); } catch (e) { return false; }
    if (!st.isFile()) return false;
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size });
    if (req.method === "HEAD") return res.end(), true;
    fs.createReadStream(file).pipe(res);
    return true;
  }

  async function handleApi(req, res, url) {
    const p = url.pathname;
    const method = req.method;
    if (method === "OPTIONS") return send(res, 204, {});

    if (p === "/api/health" && method === "GET") {
      return send(res, 200, { ok: true, service: "fantasysoul", devLogin: config.devLogin, steamLogin: !!(config.steam.webApiKey && config.steam.appId), maxDecks: config.maxDecks, deckSize: config.deckSize });
    }

    let body = {};
    if (method === "POST" || method === "PATCH") {
      try { body = await readBody(req); } catch (e) { return fail(res, 400, e.message, "요청 형식이 잘못되었습니다."); }
    }

    if (p === "/api/auth/dev" && method === "POST") {
      if (!config.devLogin) return fail(res, 403, "dev_login_disabled", "테스트 로그인이 꺼져 있습니다.");
      const r = await devLogin(store, body.name);
      if (r.error) return fail(res, 400, "bad_name", r.error);
      const s = await issueSession(store, config, r.account.id);
      return send(res, 200, { ok: true, token: s.token, expiresAt: s.expiresAt, account: publicAccount(r.account) });
    }
    if (p === "/api/auth/steam" && method === "POST") {
      const r = await steamLogin(store, config, body.ticket);
      if (r.error) return fail(res, r.status || 401, r.error, "스팀 로그인에 실패했습니다.");
      const s = await issueSession(store, config, r.account.id);
      return send(res, 200, { ok: true, token: s.token, expiresAt: s.expiresAt, account: publicAccount(r.account) });
    }

    const account = await auth(req);
    if (!account) return fail(res, 401, "unauthorized", "로그인이 필요합니다.");

    if (p === "/api/auth/logout" && method === "POST") {
      await store.deleteSession((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
      return send(res, 200, { ok: true });
    }
    if (p === "/api/me" && method === "GET") return send(res, 200, { ok: true, account: publicAccount(account) });

    if (p === "/api/decks") {
      if (method === "GET") {
        const decks = await store.listDecks(account.id);
        return send(res, 200, { ok: true, decks, maxDecks: config.maxDecks });
      }
      if (method === "POST") {
        const v = validateDeck(body, cards, config.deckSize);
        if (!v.ok) return fail(res, 422, "invalid_deck", v.errors[0], { errors: v.errors });
        if ((await store.countDecks(account.id)) >= config.maxDecks) {
          return fail(res, 409, "deck_limit", `덱은 계정당 최대 ${config.maxDecks}개까지 저장할 수 있습니다.`);
        }
        const deck = await store.createDeck(account.id, v.value);
        return send(res, 201, { ok: true, deck });
      }
    }
    const m = /^\/api\/decks\/(\d+)$/.exec(p);
    if (m) {
      const id = parseInt(m[1], 10);
      const cur = await store.getDeck(account.id, id);
      if (!cur) return fail(res, 404, "not_found", "덱을 찾을 수 없습니다.");
      if (method === "GET") return send(res, 200, { ok: true, deck: cur });
      if (method === "PATCH") {
        // Rename only ({name}) or full edit ({name?, tribe?, cards?}); the merged deck is re-validated.
        const merged = {
          name: body.name !== undefined ? body.name : cur.name,
          tribe: body.tribe !== undefined ? body.tribe : cur.tribe,
          cards: body.cards !== undefined ? body.cards : cur.cards,
        };
        if (body.name !== undefined && !normalizeName(body.name)) return fail(res, 422, "invalid_name", "덱 이름은 1~20자여야 합니다.");
        const v = validateDeck(merged, cards, config.deckSize);
        if (!v.ok) return fail(res, 422, "invalid_deck", v.errors[0], { errors: v.errors });
        const deck = await store.updateDeck(account.id, id, v.value);
        return send(res, 200, { ok: true, deck });
      }
      if (method === "DELETE") {
        await store.deleteDeck(account.id, id);
        return send(res, 200, { ok: true });
      }
    }
    return fail(res, 404, "not_found", "없는 API입니다.");
  }

  return async function handler(req, res) {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
      if ((req.method === "GET" || req.method === "HEAD") && serveStatic(req, res, url.pathname)) return;
      res.writeHead(404, { "Content-Type": "text/plain" }); res.end("not found");
    } catch (e) {
      console.error(e);
      if (!res.headersSent) fail(res, 500, "server_error", "서버 오류");
    }
  };
}

module.exports = { createApp };
