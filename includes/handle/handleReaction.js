"use strict";

module.exports = function createReactionHandler({ api, models, Users, Threads, Currencies }) {
  return async function handleReaction({ event }) {
    if (global.client.handleReaction.length === 0) return;

    const index = global.client.handleReaction.findIndex(
      (item) => String(item.messageID) === String(event.messageID)
    );
    if (index < 0) return;

    const reactionState = global.client.handleReaction.splice(index, 1)[0];
    const command = global.client.commands.get(reactionState.name);
    if (typeof command?.handleReaction !== "function") {
      return api.sendMessage(global.getText("handleReaction", "missingValue"), event.threadID, event.messageID);
    }

    const getText = (...values) => {
      let text = command.languages?.[global.config.language]?.[values[0]] || "";
      for (let valueIndex = 1; valueIndex < values.length; valueIndex += 1) {
        text = text.replace(new RegExp(`%${valueIndex}`, "g"), String(values[valueIndex]));
      }
      return text;
    };

    try {
      await command.handleReaction({
        api,
        event,
        models,
        Users,
        Threads,
        Currencies,
        handleReaction: reactionState,
        getText
      });
    } catch (error) {
      return api.sendMessage(
        global.getText("handleReaction", "executeError", error.message || error),
        event.threadID,
        event.messageID
      );
    }
  };
};
