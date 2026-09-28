"use strict";
/**
 * Steam login (to be enabled later).
 * Client (Electron + Steamworks, e.g. steamworks.js):
 *   ticket = SteamUser.GetAuthTicketForWebApi("fantasysoul")  -> hex string
 *   POST /api/auth/steam { ticket }
 * Server: ISteamUserAuth/AuthenticateUserTicket (publisher key) -> SteamID64 -> account by steam_id.
 * Needs STEAM_WEB_API_KEY (publisher Web API key) and STEAM_APP_ID.
 */
async function verifySteamTicket(config, ticket) {
  const { webApiKey, appId, identity } = config.steam;
  if (!webApiKey || !appId) return { error: "steam_not_configured", status: 501 };
  if (typeof ticket !== "string" || !/^[0-9a-fA-F]{16,4096}$/.test(ticket)) return { error: "bad_ticket", status: 400 };
  const url = "https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1/?" +
    new URLSearchParams({ key: webApiKey, appid: appId, ticket, identity }).toString();
  let data;
  try {
    const res = await fetch(url);
    data = await res.json();
  } catch (e) {
    return { error: "steam_unreachable", status: 502 };
  }
  const p = data && data.response && data.response.params;
  if (!p || p.result !== "OK" || !p.steamid) return { error: "steam_rejected", status: 401 };
  if (p.vacbanned || p.publisherbanned) return { error: "steam_banned", status: 403 };
  return { steamId: String(p.steamid) };
}

async function steamLogin(store, config, ticket) {
  const v = await verifySteamTicket(config, ticket);
  if (v.error) return v;
  let account = await store.findAccountBySteamId(v.steamId);
  // Display name: can be filled from ISteamUser/GetPlayerSummaries later.
  if (!account) account = await store.createAccount({ steamId: v.steamId, displayName: "Steam " + v.steamId.slice(-4) });
  return { account };
}

module.exports = { verifySteamTicket, steamLogin };
