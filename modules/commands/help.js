"use strict";

const stringSimilarity = require("../../utils/stringSimilarity.js");

module.exports.config = {
  name: "help",
  version: "1.2.0",
  hasPermssion: 0,
  credits: "DC-Nam, Arena update",
  description: "Xem danh sách và thông tin lệnh",
  commandCategory: "Hệ thống",
  usages: "[tên lệnh|all]",
  cooldowns: 3,
  images: []
};

module.exports.run = async function runHelp({ api, event, args }) {
  const commands = global.client.commands;
  const threadSettings = global.data.threadData.get(String(event.threadID)) || {};
  const prefix = threadSettings.PREFIX || global.config.PREFIX;
  const query = args.join(" ").trim().toLowerCase();

  if (query && query !== "all") {
    let command = commands.get(query);
    if (!command) {
      const names = [...commands.keys()];
      const match = stringSimilarity.findBestMatch(query, names).bestMatch;
      return api.sendMessage(
        match.rating >= 0.4
          ? `❎ Không tìm thấy "${query}". Lệnh gần nhất: ${prefix}${match.target}`
          : `❎ Không tìm thấy lệnh "${query}".`,
        event.threadID,
        event.messageID
      );
    }

    const config = command.config;
    const permission = ["Thành viên", "Quản trị viên nhóm", "ADMINBOT", "NDH"];
    return api.sendMessage(
      `[ HƯỚNG DẪN ]\n` +
      `─────────────────\n` +
      `📜 Tên: ${config.name}\n` +
      `👤 Tác giả: ${config.credits || config.credit || "Không rõ"}\n` +
      `🌾 Phiên bản: ${config.version || "1.0.0"}\n` +
      `🔐 Quyền: ${permission[config.hasPermssion] || "Thành viên"}\n` +
      `📝 Mô tả: ${config.description || ""}\n` +
      `🏷️ Nhóm: ${config.commandCategory}\n` +
      `🍁 Cách dùng: ${prefix}${config.name} ${config.usages || ""}\n` +
      `⏳ Chờ: ${config.cooldowns || 0}s`,
      event.threadID,
      event.messageID
    );
  }

  if (query === "all") {
    const lines = [...commands.values()]
      .sort((a, b) => a.config.name.localeCompare(b.config.name))
      .map((command, index) => `${index + 1}. ${command.config.name} — ${command.config.description || ""}`);
    return api.sendMessage(`${lines.join("\n")}\n\nTổng: ${commands.size} lệnh`, event.threadID, event.messageID);
  }

  const groups = new Map();
  for (const command of commands.values()) {
    const category = command.config.commandCategory || "Khác";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(command.config.name);
  }

  const lines = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, names]) => `• ${category}: ${names.sort().join(", ")}`);
  const adminCount = (global.config.ADMINBOT || []).length;
  return api.sendMessage(
    `╭── ${global.config.BOTNAME || "Bot-Messenger"} ──⭓\n` +
    `${lines.join("\n")}\n` +
    `─────────────────\n` +
    `📝 Tổng: ${commands.size} lệnh | ${adminCount} admin\n` +
    `📎 Dùng ${prefix}help <tên lệnh> để xem chi tiết.`,
    event.threadID,
    event.messageID
  );
};
