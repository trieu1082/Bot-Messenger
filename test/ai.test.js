"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { isReplyToBot, memberRoster } = require("../utils/ai.js");

test("AI accepts only replies to the bot message", () => {
  const api = { getCurrentUserID: () => "999" };
  assert.equal(isReplyToBot({ type: "message_reply", senderID: "100", messageReply: { senderID: "999" } }, api), true);
  assert.equal(isReplyToBot({ type: "message_reply", senderID: "100", messageReply: { senderID: "101" } }, api), false);
  assert.equal(isReplyToBot({ type: "message", senderID: "100", messageReply: { senderID: "999" } }, api), false);
});

test("AI roster contains names, nicknames and IDs", () => {
  const roster = memberRoster({
    participantIDs: ["1", "2"],
    userInfo: [{ id: "1", name: "An" }],
    nicknames: { "1": "Admin", "2": "Bình" }
  }, { rosterLimit: 10, rosterMaxChars: 1000 });
  assert.match(roster, /An \(Admin\) \| ID: 1/);
  assert.match(roster, /Bình \| ID: 2/);
});
