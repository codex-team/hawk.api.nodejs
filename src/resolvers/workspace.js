const { ApolloError } = require('apollo-server-express');
const { MongoError } = require('mongodb');
const getFieldName = require('graphql-list-fields');
const Workspace = require('../models/workspace');

/**
 * See all types and fields here {@see ../typeDefs/workspace.graphql}
 */
module.exports = {
  Query: {
    /**
     * Returns workspace(s) info by id(s)
     * Returns all user's workspaces if ids = []
     * @param {ResolverObj} _obj
     * @param {String[]} ids - workspace ids
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @param {GraphQLResolveInfo} info - Apollo's resolver info argument {@see ./index.js}
     * @return {Workspace[]}
     */
    async workspaces(_obj, { ids }, { user }, info) {
      // @todo Check if we need to validate user existance

      /*
       * Get models fields requested in query to populate
       * Used below in `deepPopulate`
       */
      const fields = getFieldName(info);

      try {
        if (ids.length === 0) {
          // Return all user's workspaces if ids = []
          return await Workspace.find({ users: user.id });
        } else {
          /*
           * Find provided list of workspaces with current user in `users`
           * Request explanation: find workspaces with provided id
           * and filter out workspaces which user have access to
           */
          return await Workspace.find({
            users: user.id,
            _id: { $in: ids }
          }).deepPopulate(fields);
        }
      } catch (err) {
        console.error('Error finding workspace', err);
        if (err instanceof MongoError) {
          throw new ApolloError('Something went wrong');
        } else {
          throw new ApolloError('Unknown error');
        }
      }
    }
  },
  Mutation: {
    /**
     * Create new workspace
     * @param {ResolverObj} _obj
     * @param {String} name - workspace name
     * @param {String} description - workspace description
     * @param {String} image - workspace image
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @return {String} created workspace id
     */
    async createWorkspace(_obj, { name, description, image }, { user }) {
      try {
        return await Workspace.create({
          name: name,
          description: description,
          image: image
        });
      } catch (err) {
        throw new ApolloError('Something went wrong');
      }
    }
  }
};
