"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { credentialsFromContent, normalizeCookie, parseAppState } = require("../utils/auth.js");
const { compareTwoStrings, findBestMatch } = require("../utils/stringSimilarity.js");

test("cookie credentials preserve values containing equals signs", () => {
  const raw = "c_user=123; xs=a=b=c; fr=value; useragent=Mozilla/5.0";
  assert.deepEqual(credentialsFromContent(raw, "test"), {
    Cookie: "c_user=123; xs=a=b=c; fr=value"
  });
  assert.equal(normalizeCookie(raw), "c_user=123; xs=a=b=c; fr=value");
});

test("invalid cookies fail before login", () => {
  assert.throws(() => credentialsFromContent("foo=bar", "test"), /c_user.*xs/);
});

test("appState accepts direct arrays and wrapped objects", () => {
  const state = [{ key: "c_user", value: "123" }];
  assert.deepEqual(parseAppState(JSON.stringify(state), "test"), state);
  assert.deepEqual(parseAppState({ appState: state }, "test"), state);
});

test("string similarity finds a nearby command", () => {
  assert.equal(compareTwoStrings("help", "help"), 1);
  const match = findBestMatch("hep", ["ping", "help", "uid"]);
  assert.equal(match.bestMatch.target, "help");
  assert.ok(match.bestMatch.rating > 0.3);
});
