"use strict";

module.exports = function createDatabaseHandler({ Users, Threads, Currencies }) {
  const logger = require("../../utils/log.js");

  return async function handleCreateDatabase({ event }) {
    if (!global.config.autoCreateDB) return;

    const senderID = String(event.senderID || event.author || "");
    const threadID = String(event.threadID || "");
    if (!threadID) return;

    try {
      const isGroup = event.isGroup === true || event.type === "event" || (senderID && senderID !== threadID);
      let thread = isGroup ? await Threads.getData(threadID) : false;

      if (isGroup && !thread) {
        const info = await Threads.getInfo(threadID);
        const threadInfo = {
          ...info,
          threadID: String(info.threadID || threadID),
          participantIDs: info.participantIDs || [],
          userInfo: info.userInfo || [],
          adminIDs: info.adminIDs || [],
          nicknames: info.nicknames || {},
          threadTheme: info.threadTheme || { id: "", accessibility_label: "" }
        };

        await Threads.createData(threadID, { threadInfo, data: {} });
        thread = await Threads.getData(threadID);
        if (!global.data.allThreadID.includes(threadID)) global.data.allThreadID.push(threadID);
        global.data.threadInfo.set(threadID, threadInfo);
        global.data.threadData.set(threadID, {});

        for (const user of threadInfo.userInfo) {
          const userID = String(user.id);
          if (!(await Users.getData(userID))) {
            await Users.createData(userID, { name: user.name, gender: user.gender, data: {} });
          }
          if (!global.data.allUserID.includes(userID)) global.data.allUserID.push(userID);
          if (user.name) global.data.userName.set(userID, user.name);
        }
        logger(`Nhóm mới: ${threadID} | ${threadInfo.threadName || "Chưa đặt tên"}`, "[ DATABASE ] >");
      }

      if (senderID && !(await Users.getData(senderID))) {
        const info = await Users.getInfo(senderID);
        await Users.createData(senderID, {
          name: info?.name || "Người dùng Facebook",
          gender: info?.gender,
          data: {}
        });
        if (!global.data.allUserID.includes(senderID)) global.data.allUserID.push(senderID);
        if (info?.name) global.data.userName.set(senderID, info.name);
        logger(`Người dùng mới: ${senderID} | ${info?.name || "Unknown"}`, "[ DATABASE ] >");
      }

      if (senderID && !(await Currencies.getData(senderID))) {
        await Currencies.createData(senderID, { data: {} });
        if (!global.data.allCurrenciesID.includes(senderID)) global.data.allCurrenciesID.push(senderID);
      }
    } catch (error) {
      logger(`Không thể cập nhật database cho sự kiện: ${error.message}`, "error");
    }
  };
};
