"use strict";

const chalk = require("chalk");

function formatLabel(type) {
  const value = String(type || "INFO").trim();
  if (value.startsWith("[")) return value;
  return `[ ${value.toUpperCase()} ]`;
}

function logger(text, type = "INFO") {
  const label = formatLabel(type);
  const output = `${label} ${String(text)}`;
  if (String(type).toLowerCase() === "error") console.error(chalk.red.bold(output));
  else if (String(type).toLowerCase() === "warn") console.warn(chalk.yellow(output));
  else console.log(chalk.cyan(output));
}

logger.loader = (text, option = "LOADING") => logger(text, option);
logger.load = (text, option = "LOGIN") => logger(text, option);

module.exports = logger;
