"use strict";

module.exports = function createCurrenciesController({ models }) {
  const Currencies = models.use("Currencies");

  async function getAll(...filters) {
    let where;
    let attributes;
    for (const filter of filters) {
      if (typeof filter !== "object" || filter === null) throw new TypeError(global.getText("currencies", "needObjectOrArray"));
      if (Array.isArray(filter)) attributes = filter;
      else where = filter;
    }
    const rows = await Currencies.findAll({ where, attributes });
    return rows.map((row) => row.get({ plain: true }));
  }

  async function getData(userID) {
    const row = await Currencies.findOne({ where: { userID: String(userID) } });
    return row ? row.get({ plain: true }) : false;
  }

  async function createData(userID, defaults = {}) {
    if (typeof defaults !== "object" || defaults === null || Array.isArray(defaults)) {
      throw new TypeError(global.getText("currencies", "needObject"));
    }
    await Currencies.findOrCreate({ where: { userID: String(userID) }, defaults });
    return true;
  }

  async function setData(userID, options = {}) {
    if (typeof options !== "object" || options === null || Array.isArray(options)) {
      throw new TypeError(global.getText("currencies", "needObject"));
    }
    const [row] = await Currencies.findOrCreate({ where: { userID: String(userID) }, defaults: options });
    await row.update(options);
    return true;
  }

  async function delData(userID) {
    return (await Currencies.destroy({ where: { userID: String(userID) } })) > 0;
  }

  async function increaseMoney(userID, money) {
    if (!Number.isFinite(money)) throw new TypeError(global.getText("currencies", "needNumber"));
    const row = await Currencies.findOne({ where: { userID: String(userID) } });
    if (!row) throw new Error(`Currency record does not exist for ${userID}`);
    await row.increment("money", { by: money });
    return true;
  }

  async function decreaseMoney(userID, money) {
    if (!Number.isFinite(money)) throw new TypeError(global.getText("currencies", "needNumber"));
    const row = await Currencies.findOne({ where: { userID: String(userID) } });
    if (!row || Number(row.money) < money) return false;
    await row.decrement("money", { by: money });
    return true;
  }

  return { getAll, getData, setData, delData, createData, increaseMoney, decreaseMoney };
};
