"use strict";

const monitor = require("./monitor.js");

function formatLabel(type) {
  const value = String(type || "INFO").trim();
  if (value.startsWith("[")) return value;
  return `[ ${value.toUpperCase()} ]`;
}

function logger(text, type = "INFO") {
  return monitor.log(String(text), formatLabel(type));
}

logger.loader = (text, option = "LOADING") => logger(text, option);
logger.load = (text, option = "LOGIN") => logger(text, option);

module.exports = logger;
