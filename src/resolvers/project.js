const { ApolloError } = require('apollo-server-express');
const { MongoError } = require('mongodb');
const Project = require('../db/models/project');

/**
 * See all types and fields here {@see ../typeDefs/workspace.graphql}
 */
module.exports = {
  Query: {},
  Mutation: {}
};
