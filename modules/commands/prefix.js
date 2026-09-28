"use strict";

const moment = require("moment-timezone");

module.exports.config = {
  name: "prefix",
  version: "2.1.0",
  hasPermssion: 0,
  credits: "DongDev, Arena update",
  description: "Xem prefix của bot",
  commandCategory: "Hệ thống",
  usages: "[]",
  cooldowns: 0
};

module.exports.handleEvent = async function handlePrefixEvent({ api, event, client }) {
  const { threadID, body } = event;
  if (!body) return;

  const triggers = ["prefix", "prefix bot là gì", "quên prefix r", "dùng sao"];
  if (!triggers.includes(body.trim().toLowerCase())) return;

  const threadSettings = global.data.threadData.get(String(threadID)) || {};
  const prefix = threadSettings.PREFIX || global.config.PREFIX;
  const time = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss || DD/MM/YYYY");
  return api.sendMessage(
    `✏️ Prefix của nhóm: ${prefix}\n📎 Prefix hệ thống: ${global.config.PREFIX}\n📝 Tổng: ${client.commands.size} lệnh\n⏰ ${time}`,
    threadID,
    event.messageID
  );
};

module.exports.run = async function runPrefix({ api, event }) {
  const threadSettings = global.data.threadData.get(String(event.threadID)) || {};
  return api.sendMessage(
    `Prefix hiện tại: ${threadSettings.PREFIX || global.config.PREFIX}`,
    event.threadID,
    event.messageID
  );
};
