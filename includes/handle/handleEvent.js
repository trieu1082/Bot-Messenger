"use strict";

const moment = require("moment-timezone");
const logger = require("../../utils/log.js");

module.exports = function createEventHandler({ api, models, Users, Threads, Currencies }) {
  return async function handleEvent({ event }) {
    const startedAt = Date.now();
    const senderID = String(event.senderID || event.author || "");
    const threadID = String(event.threadID || "");
    const isInbox = senderID === threadID || event.isGroup === false;
    if (!global.config.allowInbox && isInbox) return;
    if (global.data.userBanned.has(senderID) || global.data.threadBanned.has(threadID)) return;

    for (const eventModule of global.client.events.values()) {
      if (!eventModule.config.eventType?.includes(event.logMessageType)) continue;
      try {
        await eventModule.run({ api, event, models, Users, Threads, Currencies });
        if (global.config.DeveloperMode) {
          logger(
            global.getText(
              "handleEvent",
              "executeEvent",
              moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY"),
              eventModule.config.name,
              threadID,
              Date.now() - startedAt
            ),
            "[ EVENT ]"
          );
        }
      } catch (error) {
        logger(
          global.getText("handleEvent", "eventError", eventModule.config.name, error.message || error),
          "error"
        );
      }
    }
  };
};
