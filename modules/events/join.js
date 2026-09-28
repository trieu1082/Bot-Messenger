"use strict";

module.exports.config = {
  name: "joinNoti",
  eventType: ["log:subscribe"],
  version: "1.1.0",
  credits: "Mirai Team, Arena update",
  description: "Thông báo khi bot hoặc thành viên vào nhóm"
};

module.exports.run = async function runJoinNotification({ api, event, Users }) {
  const { threadID, logMessageData = {} } = event;
  const participants = logMessageData.addedParticipants || [];
  const botID = String(api.getCurrentUserID());

  if (participants.some((participant) => String(participant.userFbId) === botID)) {
    await api.changeNickname(
      `[ ${global.config.PREFIX} ] • ${global.config.BOTNAME || "Bot-Messenger"}`,
      threadID,
      botID
    );
    return api.sendMessage(
      `✅ ${global.config.BOTNAME || "Bot"} đã kết nối. Dùng ${global.config.PREFIX}help để xem lệnh.`,
      threadID
    );
  }

  const threadInfo = await api.getThreadInfo(threadID);
  const threadData = global.data.threadData.get(String(threadID)) || {};
  const names = [];
  const mentions = [];
  const memberNumbers = [];
  const totalMembers = threadInfo.participantIDs?.length || 0;

  for (let index = 0; index < participants.length; index += 1) {
    const participant = participants[index];
    const userID = String(participant.userFbId);
    const name = participant.fullName || await Users.getNameUser(userID);
    names.push(name);
    mentions.push({ tag: name, id: userID });
    memberNumbers.push(totalMembers - participants.length + index + 1);

    if (!(await Users.getData(userID))) await Users.createData(userID, { name, data: {} });
    if (!global.data.allUserID.includes(userID)) global.data.allUserID.push(userID);
    global.data.userName.set(userID, name);
  }

  const template = threadData.customJoin ||
    "👋 Welcome {name}.\nChào mừng đến với {threadName}.\n{type} là thành viên thứ {soThanhVien} của nhóm 🥳";
  const body = template
    .replace(/\{name}/g, names.join(", "))
    .replace(/\{type}/g, participants.length > 1 ? "Các bạn" : "Bạn")
    .replace(/\{soThanhVien}/g, memberNumbers.join(", "))
    .replace(/\{threadName}/g, threadInfo.threadName || "nhóm");

  return api.sendMessage({ body, mentions }, threadID);
};
