"use strict";

const fs = require("node:fs");
const path = require("node:path");

function readArray(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function writeArray(filePath, values) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify([...new Set(values.map(String))], null, 2)}\n`, "utf8");
}

module.exports = function createListener({ api, models }) {
  const Users = require("./controllers/users.js")({ models, api });
  const Threads = require("./controllers/threads.js")({ models, api });
  const Currencies = require("./controllers/currencies.js")({ models });
  const logger = require("../utils/log.js");
  const monitor = require("../utils/monitor.js");
  const { createAiReplyHandler } = require("../utils/ai.js");
  const dataDirectory = path.join(__dirname, "..", "utils", "data");
  const approvedPath = path.join(dataDirectory, "approvedThreads.json");
  const pendingPath = path.join(dataDirectory, "pendingThreads.json");

  fs.mkdirSync(dataDirectory, { recursive: true });
  if (!fs.existsSync(approvedPath)) writeArray(approvedPath, []);
  if (!fs.existsSync(pendingPath)) writeArray(pendingPath, []);

  const environmentReady = (async () => {
    try {
      logger.loader("Tiến hành tải dữ liệu người dùng và nhóm");
      const [threads, users, currencies] = await Promise.all([
        Threads.getAll(),
        Users.getAll(["userID", "name", "data"]),
        Currencies.getAll(["userID"])
      ]);

      for (const thread of threads) {
        const threadID = String(thread.threadID);
        global.data.allThreadID.push(threadID);
        global.data.threadData.set(threadID, thread.data || {});
        global.data.threadInfo.set(threadID, thread.threadInfo || {});
        if (thread.data?.banned) {
          global.data.threadBanned.set(threadID, {
            reason: thread.data.reason || "",
            dateAdded: thread.data.dateAdded || ""
          });
        }
        if (thread.data?.commandBanned?.length) global.data.commandBanned.set(threadID, thread.data.commandBanned);
        if (thread.data?.NSFW) global.data.threadAllowNSFW.push(threadID);
      }

      for (const user of users) {
        const userID = String(user.userID);
        global.data.allUserID.push(userID);
        if (user.name) global.data.userName.set(userID, user.name);
        if (user.data?.banned) {
          global.data.userBanned.set(userID, {
            reason: user.data.reason || "",
            dateAdded: user.data.dateAdded || ""
          });
        }
        if (user.data?.commandBanned?.length) global.data.commandBanned.set(userID, user.data.commandBanned);
      }

      for (const currency of currencies) global.data.allCurrenciesID.push(String(currency.userID));
      logger.loader(`Tải thành công dữ liệu của ${threads.length} nhóm và ${users.length} người dùng`);
    } catch (error) {
      logger(`Tải dữ liệu ban đầu thất bại: ${error.message}`, "error");
      throw error;
    }
  })();

  require("./handle/handleSchedule.js")({ api, Threads, Users, models });
  logger(
    `${api.getCurrentUserID()} - [ ${global.config.PREFIX} ] • ${global.config.BOTNAME || "Bot-Messenger"}`,
    "[ BOT INFO ] >"
  );

  const handlers = {};
  for (const file of fs.readdirSync(path.join(__dirname, "handle"))) {
    if (!file.endsWith(".js") || file === "handleSchedule.js") continue;
    const name = path.basename(file, ".js");
    handlers[name] = require(`./handle/${file}`)({ api, models, Users, Threads, Currencies });
  }
  const handleAiReply = createAiReplyHandler({ api });

  async function isApproved(event) {
    if (!global.config.approvalMode || !event.threadID) return true;

    const threadID = String(event.threadID);
    const senderID = String(event.senderID || event.author || "");
    const privileged = [...(global.config.ADMINBOT || []), ...(global.config.NDH || [])].map(String);
    if (privileged.includes(senderID) || readArray(approvedPath).includes(threadID)) return true;

    if (String(event.body || "").trim().toLowerCase() === "duyetbox") {
      const pending = readArray(pendingPath);
      if (!pending.includes(threadID)) {
        pending.push(threadID);
        writeArray(pendingPath, pending);
      }

      if (global.config.BOXADMIN) {
        await api.sendMessage(`[ Thông Báo ]\n\n📜 Yêu cầu duyệt từ box ID: ${threadID}`, String(global.config.BOXADMIN));
      }
      await api.sendMessage(
        global.config.BOXADMIN
          ? "✅ Đã gửi yêu cầu duyệt đến nhóm admin!"
          : "⚠️ Đã lưu yêu cầu nhưng BOXADMIN chưa được cấu hình.",
        threadID
      );
      return false;
    }

    const threadSettings = (await Threads.getData(threadID))?.data || {};
    const prefix = threadSettings.PREFIX || global.config.PREFIX;
    if (String(event.body || "").startsWith(prefix)) {
      await api.sendMessage('❎ Nhóm chưa được duyệt. Hãy gửi "duyetbox" để yêu cầu duyệt.', threadID);
    }
    return false;
  }

  return async function handleIncomingEvent(event) {
    if (!event || !event.threadID) return;
    monitor.recordEvent(event);
    await environmentReady;
    await handlers.handleCreateDatabase({ event });
    if (!(await isApproved(event))) return;

    switch (event.type) {
      case "message":
      case "message_reply":
      case "message_unsend":
        await Promise.all([
          handlers.handleCommand({ event }),
          handlers.handleReply({ event }),
          handlers.handleCommandEvent({ event }),
          handleAiReply({ event })
        ]);
        break;
      case "event":
        await Promise.all([
          handlers.handleEvent({ event }),
          handlers.handleRefresh({ event })
        ]);
        break;
      case "message_reaction":
        await handlers.handleReaction({ event });
        break;
      default:
        break;
    }
  };
};
