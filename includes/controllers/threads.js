"use strict";

module.exports = function createThreadsController({ models, api }) {
  const Threads = models.use("Threads");

  async function getInfo(threadID) {
    return api.getThreadInfo(String(threadID));
  }

  async function getAll(...filters) {
    let where;
    let attributes;
    for (const filter of filters) {
      if (typeof filter !== "object" || filter === null) throw new TypeError(global.getText("threads", "needObjectOrArray"));
      if (Array.isArray(filter)) attributes = filter;
      else where = filter;
    }
    const rows = await Threads.findAll({ where, attributes });
    return rows.map((row) => row.get({ plain: true }));
  }

  async function getData(threadID) {
    const row = await Threads.findOne({ where: { threadID: String(threadID) } });
    return row ? row.get({ plain: true }) : false;
  }

  async function createData(threadID, defaults = {}) {
    if (typeof defaults !== "object" || defaults === null || Array.isArray(defaults)) {
      throw new TypeError(global.getText("threads", "needObject"));
    }
    await Threads.findOrCreate({ where: { threadID: String(threadID) }, defaults });
    return true;
  }

  async function setData(threadID, options = {}) {
    if (typeof options !== "object" || options === null || Array.isArray(options)) {
      throw new TypeError(global.getText("threads", "needObject"));
    }
    const [row] = await Threads.findOrCreate({ where: { threadID: String(threadID) }, defaults: options });
    await row.update(options);
    return true;
  }

  async function delData(threadID) {
    return (await Threads.destroy({ where: { threadID: String(threadID) } })) > 0;
  }

  return { getInfo, getAll, getData, setData, delData, createData };
};
