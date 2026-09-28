"use strict";
// All settings come from environment variables so the same code runs on the box and on the VPS.
const path = require("path");

const prod = process.env.NODE_ENV === "production";

module.exports = {
  port: parseInt(process.env.PORT || "8787", 10),
  host: process.env.HOST || "0.0.0.0",
  // SQLite file. ":memory:" is allowed (tests).
  dbPath: process.env.DB_PATH || path.join(__dirname, "..", "data", "fantasysoul.db"),
  // Game data (single source of truth shared with the client).
  cardsDataPath: process.env.CARDS_DATA_PATH || path.join(__dirname, "..", "..", "fantasy_arena", "js", "cards-data.js"),
  // Serve the web game from the same origin (optional convenience for local play).
  staticDir: process.env.STATIC_DIR === "" ? null : (process.env.STATIC_DIR || path.join(__dirname, "..", "..", "fantasy_arena")),
  maxDecks: parseInt(process.env.MAX_DECKS || "10", 10),
  deckSize: 30,
  sessionDays: parseInt(process.env.SESSION_DAYS || "30", 10),
  // Temporary test login (name only). Off by default in production.
  devLogin: process.env.DEV_LOGIN ? process.env.DEV_LOGIN === "1" : !prod,
  // Steam (later): GetAuthTicketForWebApi on the client -> AuthenticateUserTicket here.
  steam: {
    webApiKey: process.env.STEAM_WEB_API_KEY || "",
    appId: process.env.STEAM_APP_ID || "",
    identity: process.env.STEAM_TICKET_IDENTITY || "fantasysoul",
  },
  corsOrigin: process.env.CORS_ORIGIN || "*",
};
