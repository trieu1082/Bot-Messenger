"use strict";

const fs = require("node:fs");
const path = require("node:path");

module.exports.config = {
  name: "duyet",
  version: "1.1.0",
  hasPermssion: 2,
  credits: "DungUwU, DongDev, Arena update",
  description: "Quản lý danh sách nhóm được dùng bot",
  commandCategory: "Admin",
  usages: "list | pending | del <threadID> | <threadID>",
  cooldowns: 3,
  prefix: true
};

const approvedPath = path.resolve(__dirname, "../../utils/data/approvedThreads.json");
const pendingPath = path.resolve(__dirname, "../../utils/data/pendingThreads.json");

function readList(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function writeList(filePath, values) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify([...new Set(values.map(String))], null, 2)}\n`, "utf8");
}

async function threadLabel(Threads, threadID) {
  const row = await Threads.getData(threadID);
  return row?.threadInfo?.threadName || row?.threadInfo?.name || "Chưa rõ tên";
}

module.exports.handleReply = async function handleApprovalReply({ event, api, handleReply, Threads }) {
  if (String(handleReply.author) !== String(event.senderID)) return;
  const approved = readList(approvedPath);
  const pending = readList(pendingPath);
  const answer = String(event.body || "").trim().toLowerCase();

  if (handleReply.type === "pending") {
    const selected = answer === "all"
      ? [...pending]
      : answer.split(/\s+/)
        .map((value) => Number.parseInt(value, 10) - 1)
        .filter((index) => Number.isInteger(index) && pending[index])
        .map((index) => pending[index]);

    const unique = [...new Set(selected)];
    if (unique.length === 0) return api.sendMessage("❎ Không có nhóm hợp lệ được chọn.", event.threadID, event.messageID);
    writeList(approvedPath, [...approved, ...unique]);
    writeList(pendingPath, pending.filter((id) => !unique.includes(id)));
    await Promise.all(unique.map((id) => api.sendMessage("✅ Nhóm đã được duyệt dùng bot.", id).catch(() => null)));
    return api.sendMessage(`✅ Đã duyệt ${unique.length} nhóm.`, event.threadID, event.messageID);
  }

  if (handleReply.type === "remove") {
    const selected = answer.split(/\s+/)
      .map((value) => Number.parseInt(value, 10) - 1)
      .filter((index) => Number.isInteger(index) && approved[index])
      .map((index) => approved[index]);
    const unique = [...new Set(selected)];
    if (unique.length === 0) return api.sendMessage("❎ Không có nhóm hợp lệ được chọn.", event.threadID, event.messageID);
    writeList(approvedPath, approved.filter((id) => !unique.includes(id)));
    return api.sendMessage(`✅ Đã gỡ duyệt ${unique.length} nhóm.`, event.threadID, event.messageID);
  }
};

module.exports.run = async function runApproval({ event, api, args, Threads }) {
  const action = String(args[0] || "").toLowerCase();
  const approved = readList(approvedPath);
  const pending = readList(pendingPath);

  if (action === "list" || action === "l") {
    const lines = await Promise.all(approved.map(async (id, index) => `${index + 1}. ${await threadLabel(Threads, id)}\nID: ${id}`));
    return api.sendMessage(
      `${lines.length ? lines.join("\n\n") : "Chưa có nhóm nào được duyệt."}\n\nReply số thứ tự để gỡ duyệt.`,
      event.threadID,
      (error, info) => {
        if (!error) global.client.handleReply.push({
          name: module.exports.config.name,
          messageID: info.messageID,
          author: event.senderID,
          type: "remove"
        });
      },
      event.messageID
    );
  }

  if (action === "pending" || action === "p") {
    const lines = await Promise.all(pending.map(async (id, index) => `${index + 1}. ${await threadLabel(Threads, id)}\nID: ${id}`));
    return api.sendMessage(
      `${lines.length ? lines.join("\n\n") : "Không có nhóm đang chờ."}\n\nReply số thứ tự hoặc "all" để duyệt.`,
      event.threadID,
      (error, info) => {
        if (!error) global.client.handleReply.push({
          name: module.exports.config.name,
          messageID: info.messageID,
          author: event.senderID,
          type: "pending"
        });
      },
      event.messageID
    );
  }

  if (action === "help" || action === "h") {
    return api.sendMessage(
      `${global.config.PREFIX}duyet list — nhóm đã duyệt\n` +
      `${global.config.PREFIX}duyet pending — nhóm đang chờ\n` +
      `${global.config.PREFIX}duyet <threadID> — duyệt nhóm\n` +
      `${global.config.PREFIX}duyet del <threadID> — gỡ duyệt và rời nhóm`,
      event.threadID,
      event.messageID
    );
  }

  if (action === "del" || action === "d") {
    const threadID = String(args[1] || event.threadID);
    if (!approved.includes(threadID)) return api.sendMessage("❎ Nhóm chưa được duyệt.", event.threadID, event.messageID);
    writeList(approvedPath, approved.filter((id) => id !== threadID));
    try {
      await api.removeUserFromGroup(api.getCurrentUserID(), threadID);
    } catch {
      // The group may already be unavailable; approval state was still removed.
    }
    return api.sendMessage(`✅ Đã gỡ duyệt nhóm ${threadID}.`, event.threadID, event.messageID);
  }

  const threadID = String(args[0] || event.threadID);
  if (!/^\d+$/.test(threadID)) return api.sendMessage("❎ Thread ID không hợp lệ.", event.threadID, event.messageID);
  if (approved.includes(threadID)) return api.sendMessage(`❎ Nhóm ${threadID} đã được duyệt.`, event.threadID, event.messageID);

  writeList(approvedPath, [...approved, threadID]);
  writeList(pendingPath, pending.filter((id) => id !== threadID));
  await api.sendMessage("✅ Nhóm đã được duyệt dùng bot.", threadID);
  return api.sendMessage(`✅ Đã duyệt nhóm ${threadID}.`, event.threadID, event.messageID);
};
