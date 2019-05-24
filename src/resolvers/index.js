const user = require('./user');
const { merge } = require('lodash');

const indexResolver = {
  Query: {
    health: () => 'ok'
  }
};

module.exports = merge(
  indexResolver,
  user
);
