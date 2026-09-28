"use strict";

module.exports = async function createModels(input) {
  const Users = require("./models/users.js")(input);
  const Threads = require("./models/threads.js")(input);
  const Currencies = require("./models/currencies.js")(input);

  await input.sequelize.sync({ force: false });

  return {
    model: { Users, Threads, Currencies },
    use(modelName) {
      const model = this.model[modelName];
      if (!model) throw new Error(`Unknown database model: ${modelName}`);
      return model;
    }
  };
};
