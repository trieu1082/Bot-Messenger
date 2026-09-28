"use strict";

const fs = require("node:fs");
const path = require("node:path");

function normalizeCookie(cookie) {
  const value = String(cookie || "").trim();
  const userAgentIndex = value.toLowerCase().indexOf("useragent=");
  return (userAgentIndex >= 0 ? value.slice(0, userAgentIndex) : value)
    .replace(/;+\s*$/, "")
    .trim();
}

function parseAppState(value, source) {
  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch (error) {
    throw new Error(`${source} không phải JSON hợp lệ: ${error.message}`);
  }

  if (parsed && Array.isArray(parsed.appState)) parsed = parsed.appState;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${source} phải là một mảng appState không rỗng.`);
  }
  return parsed;
}

function credentialsFromContent(content, source) {
  const trimmed = String(content || "").trim();
  if (!trimmed) throw new Error(`${source} đang trống.`);

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return { appState: parseAppState(trimmed, source) };
  }

  const Cookie = normalizeCookie(trimmed);
  if (!Cookie.includes("c_user=") || !Cookie.includes("xs=")) {
    throw new Error(`${source} không chứa cookie Facebook hợp lệ (thiếu c_user hoặc xs).`);
  }
  return { Cookie };
}

function loadCredentials(baseDir = process.cwd(), env = process.env) {
  if (env.FB_APPSTATE) return { appState: parseAppState(env.FB_APPSTATE, "FB_APPSTATE") };
  if (env.FB_COOKIE) return credentialsFromContent(env.FB_COOKIE, "FB_COOKIE");

  const explicitPath = env.FB_AUTH_FILE;
  const candidates = explicitPath
    ? [explicitPath]
    : ["appstate.json", "cookie.txt"];

  for (const candidate of candidates) {
    const filePath = path.resolve(baseDir, candidate);
    if (fs.existsSync(filePath)) {
      return credentialsFromContent(fs.readFileSync(filePath, "utf8"), candidate);
    }
  }

  throw new Error(
    "Chưa có thông tin đăng nhập. Hãy đặt FB_COOKIE/FB_APPSTATE hoặc tạo cookie.txt/appstate.json (các file này đã được .gitignore)."
  );
}

module.exports = {
  credentialsFromContent,
  loadCredentials,
  normalizeCookie,
  parseAppState
};
