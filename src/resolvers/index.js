const user = require('./user');
const { merge } = require('lodash');

/**
 * See all types and fields here {@see ../typeDefs/schema.graphql}
 */
const indexResolver = {
  Query: {
    health: () => 'ok'
  }
};

module.exports = merge(
  indexResolver,
  user
);
