"use strict";

module.exports.config = {
  name: "leaveNoti",
  eventType: ["log:unsubscribe"],
  version: "1.1.0",
  credits: "Ranz, Arena update",
  description: "Thông báo khi thành viên rời nhóm"
};

module.exports.run = async function runLeaveNotification({ api, event, Users, Threads }) {
  const { threadID, logMessageData = {}, author } = event;
  const userID = String(logMessageData.leftParticipantFbId || "");
  if (!userID || userID === String(api.getCurrentUserID())) return;

  const moment = require("moment-timezone");
  const time = moment.tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY || HH:mm:ss");
  const threadRow = await Threads.getData(threadID);
  const data = global.data.threadData.get(String(threadID)) || threadRow?.data || {};
  const authorData = await Users.getData(String(author));
  const authorName = authorData?.name || "quản trị viên";
  const name = global.data.userName.get(userID) || await Users.getNameUser(userID);
  const type = String(author) === userID ? "đã tự rời khỏi nhóm" : `đã bị ${authorName} mời khỏi nhóm`;

  const body = (data.customLeave || "{name} {type}\n\nLink FB ⬇️\nhttps://www.facebook.com/profile.php?id={iduser}")
    .replace(/\{name}/g, name)
    .replace(/\{type}/g, type)
    .replace(/\{iduser}/g, userID)
    .replace(/\{author}/g, authorName)
    .replace(/\{time}/g, time);

  return api.sendMessage(body, threadID);
};
