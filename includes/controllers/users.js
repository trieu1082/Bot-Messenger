"use strict";

module.exports = function createUsersController({ models, api }) {
  const Users = models.use("Users");

  async function getInfo(id) {
    const userID = String(id);
    return (await api.getUserInfo([userID]))[userID];
  }

  async function getNameUser(id) {
    const userID = String(id);
    if (global.data.userName.has(userID)) return global.data.userName.get(userID);
    const user = await getData(userID);
    return user?.name || "Người dùng Facebook";
  }

  async function getAll(...filters) {
    let where;
    let attributes;
    for (const filter of filters) {
      if (typeof filter !== "object" || filter === null) throw new TypeError(global.getText("users", "needObjectOrArray"));
      if (Array.isArray(filter)) attributes = filter;
      else where = filter;
    }
    const rows = await Users.findAll({ where, attributes });
    return rows.map((row) => row.get({ plain: true }));
  }

  async function getData(userID) {
    const row = await Users.findOne({ where: { userID: String(userID) } });
    return row ? row.get({ plain: true }) : false;
  }

  async function createData(userID, defaults = {}) {
    if (typeof defaults !== "object" || defaults === null || Array.isArray(defaults)) {
      throw new TypeError(global.getText("users", "needObject"));
    }
    await Users.findOrCreate({ where: { userID: String(userID) }, defaults });
    return true;
  }

  async function setData(userID, options = {}) {
    if (typeof options !== "object" || options === null || Array.isArray(options)) {
      throw new TypeError(global.getText("users", "needObject"));
    }
    const [row] = await Users.findOrCreate({ where: { userID: String(userID) }, defaults: options });
    await row.update(options);
    return true;
  }

  async function delData(userID) {
    return (await Users.destroy({ where: { userID: String(userID) } })) > 0;
  }

  return { getInfo, getNameUser, getAll, getData, setData, delData, createData };
};
