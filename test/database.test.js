"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Sequelize = require("sequelize");

test("database models and controllers create and update records", async (t) => {
  global.getText = () => "invalid value";
  const sequelize = new Sequelize.Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
  t.after(() => sequelize.close());

  const models = await require("../includes/database/model.js")({ Sequelize, sequelize });
  const api = {
    getThreadInfo: async (threadID) => ({ threadID, threadName: "Test" }),
    getUserInfo: async ([userID]) => ({ [userID]: { name: "Tester", gender: "UNKNOWN" } })
  };
  const Threads = require("../includes/controllers/threads.js")({ models, api });
  const Users = require("../includes/controllers/users.js")({ models, api });
  const Currencies = require("../includes/controllers/currencies.js")({ models });

  assert.equal(await Threads.getData("100"), false);
  await Threads.setData("100", { data: { PREFIX: "?" }, threadInfo: { adminIDs: [] } });
  assert.equal((await Threads.getData("100")).data.PREFIX, "?");

  await Users.setData("200", { name: "Tester", data: {} });
  assert.equal((await Users.getData("200")).name, "Tester");

  await Currencies.createData("200", { data: {} });
  await Currencies.increaseMoney("200", 50);
  await Currencies.decreaseMoney("200", 20);
  assert.equal(Number((await Currencies.getData("200")).money), 30);
});
