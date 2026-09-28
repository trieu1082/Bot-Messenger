"use strict";

const moment = require("moment-timezone");
const stringSimilarity = require("../../utils/stringSimilarity.js");
const logger = require("../../utils/log.js");

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = function createCommandHandler({ api, models, Users, Threads, Currencies }) {
  return async function handleCommand({ event }) {
    const startedAt = Date.now();
    const senderID = String(event.senderID || "");
    const threadID = String(event.threadID || "");
    const messageID = event.messageID;
    const body = typeof event.body === "string" ? event.body.trim() : "";
    if (!body || !senderID || !threadID) return;

    const {
      allowInbox,
      PREFIX,
      ADMINBOT = [],
      NDH = [],
      DeveloperMode
    } = global.config;
    const adminIDs = ADMINBOT.map(String);
    const operatorIDs = NDH.map(String);
    const isBotAdmin = adminIDs.includes(senderID) || operatorIDs.includes(senderID);
    const isInbox = senderID === threadID || event.isGroup === false;
    if (!allowInbox && isInbox) return;

    const { userBanned, threadBanned, threadData, commandBanned } = global.data;
    if (!isBotAdmin && userBanned.has(senderID)) {
      const { reason = "", dateAdded = "" } = userBanned.get(senderID) || {};
      return api.sendMessage(global.getText("handleCommand", "userBanned", reason, dateAdded), threadID, messageID);
    }
    if (!isBotAdmin && threadBanned.has(threadID)) {
      const { reason = "", dateAdded = "" } = threadBanned.get(threadID) || {};
      return api.sendMessage(global.getText("handleCommand", "threadBanned", reason, dateAdded), threadID, messageID);
    }

    const threadSettings = threadData.get(threadID) || {};
    const prefix = String(threadSettings.PREFIX || PREFIX);
    const botID = String(api.getCurrentUserID());
    const prefixRegex = new RegExp(`^(?:${escapeRegex(prefix)}|<@!?${escapeRegex(botID)}>)\\s*`);
    const prefixMatch = body.match(prefixRegex);
    const withoutPrefix = prefixMatch ? body.slice(prefixMatch[0].length).trim() : body;
    const args = withoutPrefix.split(/\s+/).filter(Boolean);
    const commandName = (args.shift() || "").toLowerCase();
    const command = global.client.commands.get(commandName);

    if (!command) {
      if (!prefixMatch || !commandName || global.client.commands.size === 0) return;
      const names = [...global.client.commands.keys()];
      const suggestion = stringSimilarity.findBestMatch(commandName, names).bestMatch;
      if (suggestion.rating >= 0.5) {
        return api.sendMessage(`❎ Lệnh không tồn tại. Có phải bạn muốn dùng: ${prefix}${suggestion.target}?`, threadID, messageID);
      }
      return api.sendMessage("❎ Lệnh không tồn tại. Dùng lệnh help để xem danh sách lệnh.", threadID, messageID);
    }

    // Commands are prefixed by default. Only prefix:false opts into prefix-less use.
    if (!prefixMatch && command.config.prefix !== false) return;

    if (!isBotAdmin) {
      const threadBans = commandBanned.get(threadID) || [];
      const userBans = commandBanned.get(senderID) || [];
      if (threadBans.includes(command.config.name)) {
        return api.sendMessage(global.getText("handleCommand", "commandThreadBanned", command.config.name), threadID, messageID);
      }
      if (userBans.includes(command.config.name)) {
        return api.sendMessage(global.getText("handleCommand", "commandUserBanned", command.config.name), threadID, messageID);
      }
    }

    if (
      String(command.config.commandCategory).toLowerCase() === "nsfw" &&
      !global.data.threadAllowNSFW.includes(threadID) &&
      !isBotAdmin
    ) {
      return api.sendMessage(global.getText("handleCommand", "threadNotAllowNSFW"), threadID, messageID);
    }

    let permission = 0;
    if (operatorIDs.includes(senderID)) permission = 3;
    else if (adminIDs.includes(senderID)) permission = 2;
    else if (!isInbox) {
      try {
        let threadInfo = (await Threads.getData(threadID))?.threadInfo;
        if (!threadInfo?.adminIDs) threadInfo = await Threads.getInfo(threadID);
        if (threadInfo?.adminIDs?.some((admin) => String(admin.id) === senderID)) permission = 1;
      } catch (error) {
        logger(`Không thể kiểm tra quyền trong nhóm ${threadID}: ${error.message}`, "warn");
      }
    }

    const requiredPermission = Number(command.config.hasPermssion ?? command.config.hasPermission ?? 0);
    if (requiredPermission > permission) {
      const labels = ["Thành viên", "Quản trị viên nhóm", "ADMINBOT", "NDH"];
      return api.sendMessage(
        `📌 Lệnh ${command.config.name} yêu cầu quyền: ${labels[requiredPermission] || requiredPermission}`,
        threadID,
        messageID
      );
    }

    if (!global.client.cooldowns.has(command.config.name)) {
      global.client.cooldowns.set(command.config.name, new Map());
    }
    const timestamps = global.client.cooldowns.get(command.config.name);
    const cooldownMs = Math.max(0, Number(command.config.cooldowns || 0)) * 1_000;
    const previous = timestamps.get(senderID) || 0;
    if (cooldownMs > 0 && startedAt < previous + cooldownMs) {
      return api.setMessageReaction("⏳", messageID, () => {}, true);
    }

    const getText = (...values) => {
      const language = command.languages?.[global.config.language];
      let text = language?.[values[0]] || "";
      for (let index = 1; index < values.length; index += 1) {
        text = text.replace(new RegExp(`%${index}`, "g"), String(values[index]));
      }
      return text;
    };

    try {
      await command.run({
        api,
        event,
        args,
        models,
        Users,
        Threads,
        Currencies,
        permssion: permission,
        permission,
        getText
      });
      timestamps.set(senderID, startedAt);

      if (DeveloperMode) {
        const time = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
        logger(
          global.getText(
            "handleCommand",
            "executeCommand",
            time,
            commandName,
            senderID,
            threadID,
            args.join(" "),
            Date.now() - startedAt
          ),
          "[ DEV MODE ]"
        );
      }
    } catch (error) {
      logger(`Lệnh ${commandName} lỗi: ${error.stack || error.message}`, "error");
      return api.sendMessage(global.getText("handleCommand", "commandError", commandName, error.message || error), threadID);
    }
  };
};
