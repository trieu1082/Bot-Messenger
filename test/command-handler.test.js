"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

function setup(command) {
  const sent = [];
  const api = {
    getCurrentUserID: () => "999",
    sendMessage: async (...args) => { sent.push(args); },
    setMessageReaction: async () => {}
  };
  global.config = {
    allowInbox: true,
    PREFIX: "!",
    ADMINBOT: [],
    NDH: [],
    DeveloperMode: false
  };
  global.data = {
    userBanned: new Map(),
    threadBanned: new Map(),
    threadData: new Map(),
    commandBanned: new Map(),
    threadAllowNSFW: []
  };
  global.client = {
    commands: new Map([[command.config.name, command]]),
    cooldowns: new Map()
  };
  global.getText = (_section, _key, ...values) => values.join(" ");
  const Threads = {
    getData: async () => ({ threadInfo: { adminIDs: [] } }),
    getInfo: async () => ({ adminIDs: [] })
  };
  const handler = require("../includes/handle/handleCommand.js")({ api, Threads });
  return { handler, sent };
}

function event(body, overrides = {}) {
  return {
    type: "message",
    body,
    senderID: "100",
    threadID: "200",
    messageID: "mid",
    isGroup: true,
    ...overrides
  };
}

test("default commands require a prefix and async command completion is awaited", async () => {
  let ran = false;
  const command = {
    config: { name: "ping", commandCategory: "test", hasPermssion: 0, cooldowns: 0 },
    run: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      ran = true;
    }
  };
  const { handler } = setup(command);
  await handler({ event: event("ping") });
  assert.equal(ran, false);
  await handler({ event: event("!ping") });
  assert.equal(ran, true);
});

test("prefix-less commands must opt in explicitly", async () => {
  let count = 0;
  const command = {
    config: { name: "hello", commandCategory: "test", hasPermssion: 0, prefix: false },
    run: async () => { count += 1; }
  };
  const { handler } = setup(command);
  await handler({ event: event("hello") });
  assert.equal(count, 1);
});

test("permission checks block regular members from admin commands", async () => {
  let ran = false;
  const command = {
    config: { name: "admincmd", commandCategory: "admin", hasPermssion: 2 },
    run: async () => { ran = true; }
  };
  const { handler, sent } = setup(command);
  await handler({ event: event("!admincmd") });
  assert.equal(ran, false);
  assert.match(String(sent[0][0]), /ADMINBOT/);
});
