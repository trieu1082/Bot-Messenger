"use strict";

const cron = require("node-cron");
const logger = require("../../utils/log.js");

module.exports = function registerSchedule({ api, Threads }) {
  return cron.schedule("*/10 * * * *", async () => {
    try {
      const inbox = await api.getThreadList(100, null, ["INBOX"]);
      const groups = inbox.filter((thread) => thread.isSubscribed && thread.isGroup);
      let changed = 0;

      for (const { threadID } of groups) {
        const newThreadInfo = await api.getThreadInfo(threadID);
        const oldThread = await Threads.getData(threadID);
        if (!oldThread || JSON.stringify(newThreadInfo) !== JSON.stringify(oldThread.threadInfo)) {
          await Threads.setData(threadID, { threadInfo: newThreadInfo });
          changed += 1;
        }
      }

      if (changed > 0) logger(`Đã cập nhật dữ liệu của ${changed}/${groups.length} nhóm`, "[ DATA ] >");
    } catch (error) {
      logger(`Không thể cập nhật dữ liệu nhóm theo lịch: ${error.message}`, "error");
    }
  }, { timezone: "Asia/Ho_Chi_Minh", noOverlap: true });
};
