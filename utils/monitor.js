"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const os = require("node:os");

const DEFAULT_LOG_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const logs = [];
const state = {
  startedAt: new Date().toISOString(),
  status: "starting",
  lastEventAt: null,
  lastMessageAt: null,
  lastError: null,
  bot: { connected: false, id: null },
  database: { connected: false },
  mqtt: { connected: false },
  ai: { configured: false, enabled: false },
  api: { listening: false, port: null },
  counters: {
    events: 0,
    messages: 0,
    errors: 0,
    aiRequests: 0,
    aiResponses: 0,
    aiErrors: 0
  }
};
let server = null;
let cleanupTimer = null;
let port = null;

function numericEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeLevel(type) {
  const value = String(type || "INFO").toLowerCase();
  if (value.includes("error")) return "error";
  if (value.includes("warn")) return "warn";
  if (value.includes("debug")) return "debug";
  return "info";
}

function normalizeType(type) {
  return String(type || "INFO").trim() || "INFO";
}

function cleanupLogs() {
  const expiresAt = Date.now() - numericEnv("LOG_TTL_MS", DEFAULT_LOG_TTL_MS);
  while (logs.length && logs[0].timestamp < expiresAt) logs.shift();
}

function log(text, type = "INFO") {
  cleanupLogs();
  const level = normalizeLevel(type);
  const item = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    time: new Date().toISOString(),
    level,
    type: normalizeType(type),
    message: String(text)
  };
  logs.push(item);
  const maxLogs = numericEnv("LOG_MAX_ITEMS", 2000);
  if (logs.length > maxLogs) logs.splice(0, logs.length - maxLogs);
  if (level === "error") {
    state.lastError = { time: item.time, message: item.message };
    state.counters.errors += 1;
  }
  if (process.env.MONITOR_CONSOLE_LOGS === "true") process.stdout.write(`${item.type} ${item.message}\n`);
  return item;
}

function mergeSection(section, value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    state[section] = { ...state[section], ...value };
  }
}

function update(patch = {}) {
  for (const [key, value] of Object.entries(patch)) {
    if (["bot", "database", "mqtt", "ai", "api", "counters"].includes(key)) mergeSection(key, value);
    else if (value !== undefined) state[key] = value;
  }
  return snapshot();
}

function increment(name, amount = 1) {
  state.counters[name] = (state.counters[name] || 0) + amount;
  return state.counters[name];
}

function recordEvent(event) {
  const now = new Date().toISOString();
  state.lastEventAt = now;
  increment("events");
  if (["message", "message_reply"].includes(event?.type)) {
    state.lastMessageAt = now;
    increment("messages");
  }
}

function configuredApiKey() {
  return String(process.env.MONITOR_API_KEY || "").trim();
}

function authorized(request) {
  const configured = configuredApiKey();
  if (!configured) return false;
  const supplied = String(request.headers["x-api-key"] || "").trim() ||
    String(request.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const expectedBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function currentRuntime() {
  const data = global.data || {};
  const config = global.config || {};
  return {
    threadCount: Array.isArray(data.allThreadID) ? data.allThreadID.length : 0,
    userCount: Array.isArray(data.allUserID) ? data.allUserID.length : 0,
    currencyCount: Array.isArray(data.allCurrenciesID) ? data.allCurrenciesID.length : 0,
    botName: config.BOTNAME || null,
    node: process.version,
    platform: process.platform,
    hostname: os.hostname(),
    memory: process.memoryUsage(),
    uptimeSeconds: Math.floor(process.uptime())
  };
}

function snapshot() {
  cleanupLogs();
  return {
    ok: state.status === "online" || state.status === "starting",
    time: new Date().toISOString(),
    ...state,
    runtime: currentRuntime(),
    checks: {
      api: state.api.listening === true,
      bot: state.bot.connected === true,
      database: state.database.connected === true,
      mqtt: state.mqtt.connected === true,
      ai: state.ai.enabled !== false && state.ai.configured === true,
      error: Boolean(state.lastError)
    }
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": process.env.MONITOR_CORS_ORIGIN || "*",
    "access-control-allow-headers": "authorization, x-api-key, content-type",
    "access-control-allow-methods": "GET, DELETE, OPTIONS"
  });
  response.end(JSON.stringify(payload));
}

function handleRequest(request, response) {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (request.method === "OPTIONS") return sendJson(response, 204, {});
  if (url.pathname === "/healthz" || url.pathname === "/health") {
    return sendJson(response, 200, {
      ok: true,
      service: "bot-messenger-monitor",
      time: new Date().toISOString()
    });
  }
  if (!url.pathname.startsWith("/api/")) return sendJson(response, 404, { ok: false, error: "Not found" });
  if (!authorized(request)) {
    return sendJson(response, configuredApiKey() ? 401 : 503, {
      ok: false,
      error: configuredApiKey() ? "Unauthorized" : "MONITOR_API_KEY is not configured"
    });
  }
  if (url.pathname === "/api/status" || url.pathname === "/api/monitor") {
    return sendJson(response, 200, snapshot());
  }
  if (url.pathname === "/api/logs" && request.method === "GET") {
    cleanupLogs();
    const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "200", 10);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 200, 1), 1000);
    const level = String(url.searchParams.get("level") || "all").toLowerCase();
    const filtered = level === "all" ? logs : logs.filter((item) => item.level === level);
    return sendJson(response, 200, {
      ok: true,
      ttlMs: numericEnv("LOG_TTL_MS", DEFAULT_LOG_TTL_MS),
      cleanupIntervalMs: numericEnv("LOG_CLEANUP_INTERVAL_MS", DEFAULT_CLEANUP_INTERVAL_MS),
      count: Math.min(filtered.length, limit),
      logs: filtered.slice(-limit)
    });
  }
  if (url.pathname === "/api/logs" && request.method === "DELETE") {
    logs.splice(0, logs.length);
    return sendJson(response, 200, { ok: true, deleted: true });
  }
  return sendJson(response, 404, { ok: false, error: "Not found" });
}

function start() {
  if (server) return server;
  port = numericEnv("PORT", numericEnv("API_PORT", 3000));
  cleanupTimer = setInterval(cleanupLogs, numericEnv("LOG_CLEANUP_INTERVAL_MS", DEFAULT_CLEANUP_INTERVAL_MS));
  server = http.createServer((request, response) => {
    try {
      handleRequest(request, response);
    } catch (error) {
      log(`Monitor API error: ${error.stack || error.message}`, "error");
      sendJson(response, 500, { ok: false, error: "Internal server error" });
    }
  });
  server.on("error", (error) => {
    update({ status: "error", api: { listening: false, port }, lastError: { time: new Date().toISOString(), message: error.message } });
    log(`Monitor API stopped: ${error.message}`, "error");
  });
  server.listen(port, "0.0.0.0", () => {
    update({ api: { listening: true, port } });
  });
  return server;
}

function stop() {
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = null;
  if (!server) return Promise.resolve();
  const activeServer = server;
  server = null;
  state.api.listening = false;
  return new Promise((resolve) => activeServer.close(() => resolve()));
}

module.exports = {
  cleanupLogs,
  increment,
  log,
  recordEvent,
  snapshot,
  start,
  stop,
  update
};
