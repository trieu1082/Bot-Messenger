"use strict";

module.exports.config = {
  name: "money",
  version: "1.2.0",
  hasPermssion: 0,
  credits: "Quất, Arena update",
  description: "Xem, chuyển hoặc quản lý số dư",
  commandCategory: "Người dùng",
  usages: "[pay <số tiền> | set/add/remove <số tiền>] [tag/reply]",
  cooldowns: 1
};

module.exports.run = async function runMoney({ Currencies, api, event, args, Users, permission }) {
  const senderID = String(event.senderID);
  const mentionedID = Object.keys(event.mentions || {})[0];
  const repliedID = event.messageReply?.senderID;
  const targetID = String(repliedID || mentionedID || senderID);
  const target = await Currencies.getData(targetID);
  if (!target) return api.sendMessage("❎ Chưa có dữ liệu số dư của người dùng.", event.threadID, event.messageID);

  const action = String(args[0] || "view").toLowerCase();
  const amount = Number(args[1]);
  const name = await Users.getNameUser(targetID);

  if (action === "view" || !args[0]) {
    return api.sendMessage(`${name} có ${Number(target.money || 0)}$.`, event.threadID, event.messageID);
  }

  if (action === "pay") {
    if (targetID === senderID) return api.sendMessage("❎ Hãy tag hoặc reply người nhận tiền.", event.threadID, event.messageID);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return api.sendMessage("❎ Số tiền phải là số nguyên dương.", event.threadID, event.messageID);
    }
    const sender = await Currencies.getData(senderID);
    if (Number(sender?.money || 0) < amount) {
      return api.sendMessage("❎ Số dư không đủ.", event.threadID, event.messageID);
    }
    await Currencies.decreaseMoney(senderID, amount);
    await Currencies.increaseMoney(targetID, amount);
    return api.sendMessage(`✅ Đã chuyển ${amount}$ cho ${name}.`, event.threadID, event.messageID);
  }

  if (!["set", "add", "remove"].includes(action)) {
    return api.sendMessage(`Cách dùng: ${global.config.PREFIX}money pay/set/add/remove <số tiền> [tag/reply]`, event.threadID, event.messageID);
  }
  if (permission < 2) return api.sendMessage("❎ Lệnh chỉnh số dư chỉ dành cho ADMINBOT/NDH.", event.threadID, event.messageID);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    return api.sendMessage("❎ Số tiền phải là số nguyên không âm.", event.threadID, event.messageID);
  }

  const current = Number(target.money || 0);
  if (action === "set") {
    if (current > 0) await Currencies.decreaseMoney(targetID, current);
    if (amount > 0) await Currencies.increaseMoney(targetID, amount);
  } else if (action === "add") {
    await Currencies.increaseMoney(targetID, amount);
  } else if (current < amount) {
    return api.sendMessage("❎ Số dư của người dùng không đủ để trừ.", event.threadID, event.messageID);
  } else {
    await Currencies.decreaseMoney(targetID, amount);
  }

  const updated = await Currencies.getData(targetID);
  return api.sendMessage(`✅ Số dư của ${name}: ${Number(updated.money || 0)}$.`, event.threadID, event.messageID);
};
