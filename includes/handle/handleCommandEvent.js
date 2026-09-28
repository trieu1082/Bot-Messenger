"use strict";

const logger = require("../../utils/log.js");

module.exports = function createCommandEventHandler({ api, models, Users, Threads, Currencies }) {
  return async function handleCommandEvent({ event }) {
    const senderID = String(event.senderID || "");
    const threadID = String(event.threadID || "");
    const isInbox = senderID === threadID || event.isGroup === false;
    if (!global.config.allowInbox && isInbox) return;
    if (global.data.userBanned.has(senderID) || global.data.threadBanned.has(threadID)) return;

    const args = typeof event.body === "string" ? event.body.trim().split(/\s+/).slice(1) : [];
    for (const commandName of global.client.eventRegistered) {
      const command = global.client.commands.get(commandName);
      if (typeof command?.handleEvent !== "function") continue;

      const getText = (...values) => {
        let text = command.languages?.[global.config.language]?.[values[0]] || "";
        for (let index = 1; index < values.length; index += 1) {
          text = text.replace(new RegExp(`%${index}`, "g"), String(values[index]));
        }
        return text;
      };

      try {
        await command.handleEvent({
          event,
          args,
          api,
          client: global.client,
          models,
          Users,
          Threads,
          Currencies,
          getText
        });
      } catch (error) {
        logger(`handleEvent của lệnh ${commandName} bị lỗi: ${error.stack || error.message}`, "error");
      }
    }
  };
};
