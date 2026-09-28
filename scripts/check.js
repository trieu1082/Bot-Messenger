"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules", "coverage"]);

function walk(directory, extension, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, extension, output);
    else if (entry.name.endsWith(extension)) output.push(fullPath);
  }
  return output;
}

const javascriptFiles = walk(root, ".js");
for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  assert.equal(result.status, 0, `Syntax error in ${path.relative(root, file)}:\n${result.stderr}`);
}

for (const file of walk(root, ".json")) {
  JSON.parse(fs.readFileSync(file, "utf8"));
}

global.config = require(path.join(root, "config.json"));
global.client = {
  commands: new Map(),
  events: new Map(),
  cooldowns: new Map(),
  eventRegistered: [],
  handleReaction: [],
  handleReply: [],
  mainPath: root
};
global.data = { threadData: new Map() };

let moduleCount = 0;
for (const type of ["commands", "events"]) {
  const directory = path.join(root, "modules", type);
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".js"))) {
    const moduleItem = require(path.join(directory, file));
    assert.equal(typeof moduleItem.config, "object", `${type}/${file} is missing config`);
    assert.equal(typeof moduleItem.config.name, "string", `${type}/${file} is missing config.name`);
    assert.equal(typeof moduleItem.run, "function", `${type}/${file} is missing run`);
    if (type === "commands") {
      assert.equal(typeof moduleItem.config.commandCategory, "string", `${type}/${file} is missing commandCategory`);
    }
    moduleCount += 1;
  }
}

const login = require("@dongdev/fca-unofficial");
assert.equal(typeof login, "function", "@dongdev/fca-unofficial does not export a login function");

console.log(`✓ Checked ${javascriptFiles.length} JavaScript files and ${moduleCount} bot modules.`);
