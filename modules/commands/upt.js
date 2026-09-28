"use strict";

const os = require("node:os");

module.exports = {
  config: {
    name: "uptime",
    version: "1.1.0",
    hasPermssion: 0,
    credits: "quocduy, Arena update",
    description: "Xem thời gian chạy và tài nguyên của bot",
    commandCategory: "Hệ thống",
    usages: "[]",
    cooldowns: 5
  },
  run: async ({ api, event }) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3_600);
    const minutes = Math.floor((uptime % 3_600) / 60);
    const seconds = Math.floor(uptime % 60);
    const memory = process.memoryUsage();
    const load = os.loadavg()[0].toFixed(2);
    const message =
      `🤖 Thông tin bot\n\n` +
      `⏱️ Uptime: ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}\n` +
      `🟢 Node.js: ${process.version}\n` +
      `💾 RAM bot: ${(memory.rss / 1024 / 1024).toFixed(1)} MB\n` +
      `📊 Load 1 phút: ${load}`;
    return api.sendMessage(message, event.threadID, event.messageID);
  }
};
