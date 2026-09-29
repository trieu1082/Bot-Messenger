"use strict";

const { spawn } = require("node:child_process");
const logger = require("./utils/log");

const RESTART_EXIT_CODE = 75;
const MAX_RESTARTS = Math.max(0, Number.parseInt(process.env.BOT_MAX_RESTARTS || "5", 10));
let restartCount = 0;
let child = null;
let stopping = false;

function startBot(message) {
  if (message) logger(message, "[ STARTING ]");

  child = spawn(process.execPath, ["--trace-warnings", "--async-stack-traces", "mirai.js"], {
    cwd: __dirname,
    stdio: "ignore",
    shell: false
  });

  child.once("error", (error) => {
    logger(`Không thể khởi động bot: ${error.message}`, "error");
    process.exitCode = 1;
  });

  child.once("close", (code, signal) => {
    child = null;

    if (stopping) {
      process.exit(code ?? (signal ? 1 : 0));
      return;
    }

    if (code === RESTART_EXIT_CODE && restartCount < MAX_RESTARTS) {
      restartCount += 1;
      const delay = Math.min(restartCount * 1_000, 5_000);
      logger(`Khởi động lại bot (${restartCount}/${MAX_RESTARTS}) sau ${delay / 1_000}s...`, "[ RESTART ]");
      setTimeout(() => startBot(), delay);
      return;
    }

    if (code === RESTART_EXIT_CODE) {
      logger(`Bot đã vượt quá giới hạn ${MAX_RESTARTS} lần khởi động lại.`, "error");
      process.exitCode = 1;
      return;
    }

    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
    if (child && !child.killed) child.kill(signal);
    else process.exit(0);
  });
}

startBot();
