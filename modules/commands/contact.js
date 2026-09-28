"use strict";

module.exports.config = {
  name: "contact",
  version: "1.1.0",
  hasPermssion: 0,
  credits: "DongDev, Arena update",
  description: "Chia sẻ liên hệ của một người dùng",
  commandCategory: "Công cụ",
  usages: "[userID/link/tag/reply]",
  cooldowns: 5,
  prefix: false
};

module.exports.run = async function runContact({ api, event, args }) {
  let userID = event.messageReply?.senderID || Object.keys(event.mentions || {})[0] || args[0] || event.senderID;
  if (typeof userID === "string" && /^https?:\/\//i.test(userID)) {
    userID = await api.getUID(userID);
  }
  if (!/^\d+$/.test(String(userID))) {
    return api.sendMessage("❎ Không thể xác định ID người dùng.", event.threadID, event.messageID);
  }
  return api.shareContact("", String(userID), event.threadID);
};
