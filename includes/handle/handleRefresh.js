"use strict";

module.exports = function createRefreshHandler({ api, Threads }) {
  const logger = require("../../utils/log.js");

  return async function handleRefresh({ event }) {
    const { threadID, logMessageType, logMessageData = {} } = event;
    const row = await Threads.getData(threadID);
    if (!row) return;

    const threadInfo = row.threadInfo || {};
    threadInfo.adminIDs ||= [];
    threadInfo.participantIDs ||= [];

    switch (logMessageType) {
      case "log:thread-admins":
        if (logMessageData.ADMIN_EVENT === "add_admin") {
          if (!threadInfo.adminIDs.some((item) => String(item.id) === String(logMessageData.TARGET_ID))) {
            threadInfo.adminIDs.push({ id: String(logMessageData.TARGET_ID) });
          }
        } else if (logMessageData.ADMIN_EVENT === "remove_admin") {
          threadInfo.adminIDs = threadInfo.adminIDs.filter(
            (item) => String(item.id) !== String(logMessageData.TARGET_ID)
          );
        }
        await Threads.setData(threadID, { threadInfo });
        logger(`Đã làm mới danh sách quản trị viên tại nhóm ${threadID}`, "[ UPDATE DATA ]");
        break;

      case "log:thread-name":
        threadInfo.threadName = logMessageData.name;
        await Threads.setData(threadID, { threadInfo });
        logger(`Đã cập nhật tên nhóm ${threadID}`, "[ UPDATE DATA ]");
        break;

      case "log:unsubscribe": {
        const userID = String(logMessageData.leftParticipantFbId || "");
        if (userID === String(api.getCurrentUserID())) {
          global.data.allThreadID = global.data.allThreadID.filter((id) => String(id) !== String(threadID));
          global.data.threadInfo.delete(String(threadID));
          global.data.threadData.delete(String(threadID));
          await Threads.delData(threadID);
          logger(`Đã xóa dữ liệu nhóm ${threadID}`, "[ DELETE DATA ]");
          return;
        }
        threadInfo.participantIDs = threadInfo.participantIDs.filter((id) => String(id) !== userID);
        threadInfo.adminIDs = threadInfo.adminIDs.filter((item) => String(item.id) !== userID);
        await Threads.setData(threadID, { threadInfo });
        break;
      }

      default:
        break;
    }
  };
};
