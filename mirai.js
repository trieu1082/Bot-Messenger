"use strict";

const fs = require("fs-extra");
const moment = require("moment-timezone");
const path = require("node:path");
const login = require("@dongdev/fca-unofficial");
const logger = require("./utils/log.js");
const { loadCredentials } = require("./utils/auth.js");
const monitor = require("./utils/monitor.js");

const ROOT_DIR = __dirname;
monitor.start();
monitor.update({ status: "starting" });
const PACKAGE_VERSION = require("./package.json").version;

fs.ensureDirSync(path.join(ROOT_DIR, "utils", "data"));

global.client = {
  commands: new Map(),
  events: new Map(),
  cooldowns: new Map(),
  eventRegistered: [],
  handleReaction: [],
  handleReply: [],
  mainPath: ROOT_DIR,
  configPath: path.join(ROOT_DIR, "config.json"),
  timeStart: Date.now(),
  getTime: (option) => moment.tz("Asia/Ho_Chi_Minh").format({
    seconds: "ss",
    minutes: "mm",
    hours: "HH",
    date: "DD",
    month: "MM",
    year: "YYYY",
    fullHour: "HH:mm:ss",
    fullYear: "DD/MM/YYYY",
    fullTime: "HH:mm:ss DD/MM/YYYY"
  }[option])
};

global.data = {
  threadInfo: new Map(),
  threadData: new Map(),
  userName: new Map(),
  userBanned: new Map(),
  threadBanned: new Map(),
  commandBanned: new Map(),
  threadAllowNSFW: [],
  allUserID: [],
  allCurrenciesID: [],
  allThreadID: [],
  botID: null
};

global.utils = require("./utils/func.js");
global.config = require("./config.json");
global.configModule = {};
global.moduleData = [];
global.language = {};

function loadLanguage(language) {
  const languagePath = path.join(ROOT_DIR, "languages", `${language}.lang`);
  if (!fs.existsSync(languagePath)) {
    throw new Error(`Không tìm thấy file ngôn ngữ: ${languagePath}`);
  }

  const lines = fs.readFileSync(languagePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;

    const fullKey = trimmed.slice(0, separator);
    const dot = fullKey.indexOf(".");
    if (dot < 1) continue;

    const section = fullKey.slice(0, dot);
    const key = fullKey.slice(dot + 1);
    const value = trimmed.slice(separator + 1).replace(/\\n/g, "\n");
    global.language[section] ||= {};
    global.language[section][key] = value;
  }
}

loadLanguage(global.config.language || "vi");

global.getText = function getText(section, key, ...values) {
  const text = global.language[section]?.[key];
  if (typeof text !== "string") {
    throw new Error(`Không tìm thấy khóa ngôn ngữ: ${section}.${key}`);
  }

  return values.reduce(
    (result, value, index) => result.replace(new RegExp(`%${index + 1}`, "g"), String(value)),
    text
  );
};

function normalizeModule(moduleItem, file, type) {
  if (!moduleItem?.config || typeof moduleItem.run !== "function") {
    throw new Error(`Module ${file} không đúng định dạng`);
  }
  if (type === "commands" && !moduleItem.config.commandCategory) {
    throw new Error(`Lệnh ${file} thiếu commandCategory`);
  }

  const permission = Number(moduleItem.config.hasPermssion ?? moduleItem.config.hasPermission ?? 0);
  if (!Number.isInteger(permission) || permission < 0 || permission > 3) {
    throw new Error(`Lệnh ${file} có hasPermssion không hợp lệ`);
  }
  moduleItem.config.hasPermssion = permission;
  moduleItem.config.images ||= [];
  return moduleItem;
}

async function loadModules(directory, collection, disabledList = [], type) {
  const disabled = new Set(disabledList.map((name) => name.endsWith(".js") ? name : `${name}.js`));
  const files = fs.readdirSync(directory)
    .filter((file) => file.endsWith(".js") && !file.includes("example") && !disabled.has(file));

  let loadedCount = 0;
  for (const file of files) {
    try {
      const item = normalizeModule(require(path.join(directory, file)), file, type);
      const { config, onLoad, handleEvent } = item;
      const target = global.client[collection];

      if (target.has(config.name)) throw new Error(`Tên module bị trùng: ${config.name}`);

      if (config.envConfig && typeof config.envConfig === "object") {
        global.configModule[config.name] ||= {};
        global.config[config.name] ||= {};
        for (const [key, defaultValue] of Object.entries(config.envConfig)) {
          const value = global.config[config.name][key] ?? defaultValue ?? "";
          global.configModule[config.name][key] = value;
          global.config[config.name][key] = value;
        }
      }

      if (typeof onLoad === "function") await onLoad({ api: global.client.api, models: global.client.models });
      if (typeof handleEvent === "function") global.client.eventRegistered.push(config.name);
      target.set(config.name, item);
      loadedCount += 1;
    } catch (error) {
      logger(`Không thể tải ${type === "commands" ? "lệnh" : "sự kiện"} ${file}: ${error.message}`, "error");
    }
  }
  return loadedCount;
}

function loginAsync(credentials, options) {
  return new Promise((resolve, reject) => {
    login(credentials, options, (error, api) => error ? reject(error) : resolve(api));
  });
}

async function startBot(models, sequelize) {
  const credentials = loadCredentials(ROOT_DIR);
  const api = await loginAsync(credentials, global.config.FCAOption || {});

  api.setOptions(global.config.FCAOption || {});
  global.client.api = api;
  global.client.models = models;
  global.client.timeStart = Date.now();

  const userID = String(api.getCurrentUserID());
  global.data.botID = userID;
  monitor.update({ bot: { connected: true, id: userID }, status: "starting" });

  try {
    const appState = api.getAppState();
    fs.writeFileSync(path.join(ROOT_DIR, "utils", "data", "fbstate.json"), JSON.stringify(appState, null, 2), {
      encoding: "utf8",
      mode: 0o600
    });
  } catch (error) {
    logger(`Không thể lưu phiên đăng nhập mới: ${error.message}`, "warn");
  }

  let userName = "Facebook user";
  try {
    const users = await api.getUserInfo([userID]);
    userName = users?.[userID]?.name || userName;
  } catch (error) {
    logger(`Không thể lấy tên tài khoản bot: ${error.message}`, "warn");
  }
  logger(`Đăng nhập thành công - ${userName} (${userID})`, "[ LOGIN ] >");

  const commandPath = path.join(ROOT_DIR, "modules", "commands");
  const eventPath = path.join(ROOT_DIR, "modules", "events");
  const commands = await loadModules(commandPath, "commands", global.config.commandDisabled, "commands");
  const events = await loadModules(eventPath, "events", global.config.eventDisabled, "events");
  logger.loader(`Loaded ${commands} commands`);
  logger.loader(`Loaded ${events} events`);
  logger.loader(`Source v${PACKAGE_VERSION} loaded in ${Date.now() - global.client.timeStart}ms`);

  const listener = require("./includes/listen.js")({ api, models });
  const ignoredEvents = new Set(["presence", "typ", "read_receipt", "ready"]);

  function listenerCallback(error, event) {
    if (error) {
      logger(global.getText("mirai", "handleListenError", error.message || JSON.stringify(error)), "error");
      monitor.update({ status: "error", mqtt: { connected: false } });
      return;
    }
    if (!event || ignoredEvents.has(event.type)) return;

    Promise.resolve(listener(event)).catch((listenerError) => {
      logger(`Không thể xử lý sự kiện: ${listenerError.stack || listenerError.message}`, "error");
      monitor.update({ status: "error" });
    });
  }

  global.handleListen = api.listenMqtt(listenerCallback);
  monitor.update({ status: "online", mqtt: { connected: true } });
  logger(global.getText("mirai", "successConnectMQTT"), "[ MQTT ]");

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger(`Đang dừng bot (${signal})...`, "[ SHUTDOWN ]");
    try {
      if (typeof api.stopListeningAsync === "function") await api.stopListeningAsync();
      else if (typeof api.stopListening === "function") api.stopListening();
    } catch (error) {
      logger(`Lỗi khi ngắt MQTT: ${error.message}`, "warn");
    }
    try {
      await sequelize.close();
      monitor.update({ database: { connected: false }, mqtt: { connected: false }, status: "stopped" });
    } catch (error) {
      logger(`Lỗi khi đóng database: ${error.message}`, "warn");
    }
    await monitor.stop();
    process.exit(0);
  }

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

async function main() {
  const { Sequelize, sequelize } = require("./includes/database/index.js");
  try {
    await sequelize.authenticate();
    monitor.update({ database: { connected: true } });
    const models = await require("./includes/database/model.js")({ Sequelize, sequelize });
    logger(global.getText("mirai", "successConnectDatabase"), "[ DATABASE ]");
    await startBot(models, sequelize);
  } catch (error) {
    logger(error.stack || error.message || String(error), "error");
    monitor.update({ status: "error", bot: { connected: false }, database: { connected: false }, mqtt: { connected: false } });
    try {
      await sequelize.close();
    } catch {
      monitor.update({ database: { connected: false } });
    }
    return;
  }
}

process.on("unhandledRejection", (error) => {
  logger(`Unhandled rejection: ${error?.stack || error}`, "error");
});

void main();
