"use strict";

const fs = require("node:fs");
const path = require("node:path");

module.exports.config = {
  name: "admin",
  version: "1.1.0",
  hasPermssion: 2,
  credits: "quocduy & Arena update",
  description: "Quản lý danh sách người điều hành (NDH)",
  commandCategory: "Admin",
  usages: "list | add/remove [userID, tag hoặc reply]",
  cooldowns: 2
};

module.exports.run = async function runAdmin({ api, event, args }) {
  const configPath = path.join(global.client.mainPath, "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.NDH = (config.NDH || []).map(String);
  const action = String(args[0] || "list").toLowerCase();
  const targetID = String(
    event.messageReply?.senderID || Object.keys(event.mentions || {})[0] || args[1] || ""
  );

  if (action === "list") {
    return api.sendMessage(
      config.NDH.length ? `NDH:\n${config.NDH.map((id) => `- ${id}`).join("\n")}` : "Chưa có NDH.",
      event.threadID,
      event.messageID
    );
  }

  if (!/^\d+$/.test(targetID)) {
    return api.sendMessage("❎ Hãy cung cấp user ID, tag người dùng hoặc reply tin nhắn.", event.threadID, event.messageID);
  }

  if (action === "add") {
    if (config.NDH.includes(targetID)) {
      return api.sendMessage("Người dùng này đã là NDH.", event.threadID, event.messageID);
    }
    config.NDH.push(targetID);
    global.config.NDH = [...config.NDH];
  } else if (action === "remove") {
    if (!config.NDH.includes(targetID)) {
      return api.sendMessage("Người dùng này không có trong danh sách NDH.", event.threadID, event.messageID);
    }
    config.NDH = config.NDH.filter((id) => id !== targetID);
    global.config.NDH = [...config.NDH];
  } else {
    return api.sendMessage(`Cách dùng: ${global.config.PREFIX}admin list/add/remove [userID]`, event.threadID, event.messageID);
  }

  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return api.sendMessage(
    action === "add" ? `✅ Đã thêm ${targetID} làm NDH.` : `✅ Đã xóa ${targetID} khỏi NDH.`,
    event.threadID,
    event.messageID
  );
};
