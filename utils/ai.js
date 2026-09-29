"use strict";

const axios = require("axios");
const monitor = require("./monitor.js");
const logger = require("./log.js");

const DEFAULT_SYSTEM_PROMPT = "Bạn là AI do PMT phát triển để hỗ trợ trò chuyện với thành viên trong group. Hãy dùng danh sách thành viên được cung cấp khi cần thiết, không bịa thông tin về họ. Nói chuyện nhanh gọn, súc tích, dùng ít emoji, xưng mày và tao cho giống bạn bè, có phong cách châm biếm và khịa vừa phải nhưng không xúc phạm nghiêm trọng, đe dọa, phân biệt đối xử hoặc hướng dẫn hành vi nguy hiểm.";

function getSettings() {
  const settings = global.config?.AI || {};
  return {
    enabled: settings.enabled !== false,
    onlyReplyToBot: settings.onlyReplyToBot !== false,
    onlyGroup: settings.onlyGroup !== false,
    endpoint: process.env.GROQ_API_URL || settings.endpoint || "https://api.groq.com/openai/v1/chat/completions",
    model: process.env.GROQ_MODEL || settings.model || "llama-3.3-70b-versatile",
    temperature: Number.isFinite(Number(settings.temperature)) ? Number(settings.temperature) : 0.7,
    maxTokens: Math.max(1, Number.parseInt(process.env.GROQ_MAX_TOKENS || settings.maxTokens || "600", 10)),
    rosterLimit: Math.max(1, Number.parseInt(settings.rosterLimit || "300", 10)),
    rosterMaxChars: Math.max(1000, Number.parseInt(settings.rosterMaxChars || "12000", 10)),
    cooldownMs: Math.max(0, Number.parseInt(settings.cooldownMs || "3000", 10)),
    systemPrompt: process.env.AI_SYSTEM_PROMPT || settings.systemPrompt || DEFAULT_SYSTEM_PROMPT
  };
}

function memberRoster(threadInfo, settings) {
  const knownNames = new Map();
  for (const user of threadInfo?.userInfo || []) {
    if (user?.id) knownNames.set(String(user.id), user.name || user.fullName || "");
  }
  for (const [id, name] of Object.entries(threadInfo?.nicknames || {})) {
    if (name && knownNames.has(String(id))) knownNames.set(String(id), `${knownNames.get(String(id))} (${name})`);
    else if (name) knownNames.set(String(id), name);
  }
  const ids = (threadInfo?.participantIDs || []).map(String);
  for (const id of knownNames.keys()) if (!ids.includes(id)) ids.push(id);
  const lines = ids.slice(0, settings.rosterLimit).map((id, index) => {
    const name = knownNames.get(id) || "Chưa rõ tên";
    return `${index + 1}. ${name} | ID: ${id}`;
  });
  const result = lines.join("\n");
  return result.length > settings.rosterMaxChars ? `${result.slice(0, settings.rosterMaxChars)}\n... danh sách đã được rút gọn` : result;
}

function isReplyToBot(event, api) {
  const botID = String(api.getCurrentUserID());
  const replySenderID = String(event.messageReply?.senderID || event.messageReply?.author || "");
  return event.type === "message_reply" && replySenderID === botID && String(event.senderID || "") !== botID;
}

function isPrefixedCommand(body, threadID) {
  const settings = global.data?.threadData?.get(String(threadID)) || {};
  const prefix = String(settings.PREFIX || global.config?.PREFIX || "!");
  return body.trim().startsWith(prefix);
}

function createAiReplyHandler({ api }) {
  const lastRequestAt = new Map();
  const settings = getSettings();
  monitor.update({ ai: { enabled: settings.enabled, configured: Boolean(process.env.GROQ_API_KEY), model: settings.model } });

  return async function handleAiReply({ event }) {
    const currentSettings = getSettings();
    monitor.update({ ai: { enabled: currentSettings.enabled, configured: Boolean(process.env.GROQ_API_KEY), model: currentSettings.model } });
    if (!currentSettings.enabled || !process.env.GROQ_API_KEY) return false;
    const isGroup = event.isGroup === true || String(event.senderID || "") !== String(event.threadID || "");
    if (currentSettings.onlyGroup && !isGroup) return false;
    if (currentSettings.onlyReplyToBot && !isReplyToBot(event, api)) return false;
    const body = typeof event.body === "string" ? event.body.trim() : "";
    if (!body || isPrefixedCommand(body, event.threadID)) return false;

    const threadID = String(event.threadID || "");
    const previousRequest = lastRequestAt.get(threadID) || 0;
    if (Date.now() - previousRequest < currentSettings.cooldownMs) return false;
    lastRequestAt.set(threadID, Date.now());
    monitor.increment("aiRequests");
    monitor.update({ ai: { lastRequestAt: new Date().toISOString(), lastError: null } });

    try {
      const threadInfo = await api.getThreadInfo(threadID);
      const roster = memberRoster(threadInfo, currentSettings) || "Không lấy được danh sách thành viên.";
      const quotedBotMessage = String(event.messageReply?.body || "").trim();
      const context = [
        `Tên nhóm: ${threadInfo?.threadName || "Không rõ"}`,
        `Người đang nói ID: ${event.senderID || "Không rõ"}`,
        `Tin nhắn trước đó của bot: ${quotedBotMessage || "Không có nội dung"}`,
        "Danh sách thành viên:",
        roster
      ].join("\n");
      const response = await axios.post(
        currentSettings.endpoint,
        {
          model: currentSettings.model,
          messages: [
            { role: "system", content: `${currentSettings.systemPrompt}\n\nBối cảnh nhóm:\n${context}` },
            { role: "user", content: body }
          ],
          temperature: currentSettings.temperature,
          max_tokens: currentSettings.maxTokens
        },
        {
          timeout: 25_000,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${process.env.GROQ_API_KEY}`
          }
        }
      );
      const answer = String(response.data?.choices?.[0]?.message?.content || "").trim();
      if (!answer) throw new Error("Groq không trả về nội dung");
      await api.sendMessage(answer, threadID, event.messageID);
      monitor.increment("aiResponses");
      monitor.update({ ai: { lastResponseAt: new Date().toISOString(), lastError: null } });
      return true;
    } catch (error) {
      const detail = error.response?.data?.error?.message || error.message || String(error);
      monitor.increment("aiErrors");
      monitor.update({ ai: { lastError: detail } });
      logger(`AI request lỗi: ${detail}`, "error");
      await api.sendMessage("AI đang lỗi hoặc hết hạn mức, thử lại sau nhé.", threadID, event.messageID).catch(() => {});
      return false;
    }
  };
}

module.exports = {
  DEFAULT_SYSTEM_PROMPT,
  createAiReplyHandler,
  isReplyToBot,
  memberRoster
};
