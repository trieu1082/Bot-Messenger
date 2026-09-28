"use strict";

module.exports.config = {
  name: "rs",
  version: "1.1.0",
  hasPermssion: 3,
  credits: "DongDev, Arena update",
  description: "Khởi động lại bot",
  commandCategory: "Admin",
  cooldowns: 5,
  images: []
};

module.exports.run = ({ event, api }) => {
  api.sendMessage("✅ Đang khởi động lại bot...", event.threadID, () => process.exit(75), event.messageID);
};
