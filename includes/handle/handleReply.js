"use strict";

module.exports = function createReplyHandler({ api, models, Users, Threads, Currencies }) {
  return async function handleReply({ event }) {
    if (!event.messageReply || global.client.handleReply.length === 0) return;

    const index = global.client.handleReply.findIndex(
      (item) => String(item.messageID) === String(event.messageReply.messageID)
    );
    if (index < 0) return;

    const replyState = global.client.handleReply.splice(index, 1)[0];
    const command = global.client.commands.get(replyState.name);
    if (typeof command?.handleReply !== "function") {
      return api.sendMessage(global.getText("handleReply", "missingValue"), event.threadID, event.messageID);
    }

    const getText = (...values) => {
      let text = command.languages?.[global.config.language]?.[values[0]] || "";
      for (let valueIndex = 1; valueIndex < values.length; valueIndex += 1) {
        text = text.replace(new RegExp(`%${valueIndex}`, "g"), String(values[valueIndex]));
      }
      return text;
    };

    try {
      await command.handleReply({
        api,
        event,
        models,
        Users,
        Threads,
        Currencies,
        handleReply: replyState,
        getText
      });
    } catch (error) {
      return api.sendMessage(
        global.getText("handleReply", "executeError", error.message || error),
        event.threadID,
        event.messageID
      );
    }
  };
};
