const { ApolloError, ForbiddenError } = require('apollo-server-express');
const { MongoError } = require('mongodb');
const getFieldName = require('graphql-list-fields');
const Workspace = require('../models/workspace');
const User = require('../models/user');

/**
 * See all types and fields here {@see ../typeDefs/workspace.graphql}
 */
module.exports = {
  Query: {
    /**
     * Returns workspace(s) info by id(s)
     * @param {ResolverObj} _obj
     * @param {String[]} ids - workspace ids
     * @param {Context}
     * @param {GraphQLResolveInfo} info
     * @return {Workspace}
     */
    async workspaces(_obj, { ids }, { user }, info) {
      // @todo Check if we need to validate user existance

      // We request the data of the workspace with expanded fields
      const fields = getFieldName(info);

      try {
        if (ids.length === 0) {
          return await Workspace.find({ users: user.id });
        } else {
          // Find provided list of workspaces with current user in `users`
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
     * @param {Context}
     * @return {String} created workspace id
     */
    async createWorkspace(_obj, { name, description, image }, { user }) {
      // Perhaps here in the future it is worth passing an array of users
      const ownerId = user.id;

      try {
        // Create new workspace in mongo
        const w = await Workspace.create({
          name: name,
          description: description,
          users: [ ownerId ],
          image: image
        });

        // update the list of workspaces at user model
        await User.findByIdAndUpdate(ownerId, {
          $push: {
            workspaces: w._id
          }
        });

        return w._id;
      } catch (err) {
        console.error('Error finding workspace', err);
        if (err instanceof MongoError) {
          throw new ApolloError('Something went wrong');
        } else {
          throw new ApolloError('Unknown error');
        }
      }
    }
  }
};
