const { ApolloError, ForbiddenError } = require('apollo-server-express');
const { MongoError } = require('mongodb');
const { CastError } = require('mongoose');
const Workspace = require('../models/workspace');
const User = require('../models/user');

/**
 * See all types and fields here {@see ../typeDefs/workspace.graphql}
 */
module.exports = {
  Query: {
    /**
     * Returns all user's workspaces
     * @param {ResolverObj} _obj
     * @param {ResolverArgs} _args
     * @param {Context}
     * @return {Workspace[]}
     */
    async workspaces(_obj, _args, { user }) {
      if (user && !user.id) {
        throw new ForbiddenError('Only authorized users can do this');
      }

      try {
        return (await User.findById(user.id)
          .populate({
            path: 'workspaces',
            populate: [
              {
                path: 'users',
                model: 'User'
              },
              {
                path: 'projects',
                model: 'Project'
              }
            ]
          })).workspaces;
      } catch (err) {
        console.error('Error finding workspaces', err);
        throw new ApolloError('Something went wrong');
      }
    },

    /**
     * Returns workspace info by id
     * @param {ResolverObj} _obj
     * @param {ResolverArgs} _args
     * @param {String} _args.id - workspace id
     * @param {Context}
     * @return {Workspace}
     */
    workspace: async (_obj, { id }, { user }) => {
      if (user && !user.id) {
        throw new ForbiddenError('Only authorized users can do this');
      }

      let userData;

      // Check user access to the workspace
      try {
        userData = await User.findById(user.id);
      } catch (err) {
        console.error('Error finding user', err);
        if (err instanceof MongoError) {
          throw new ApolloError('Something went wrong');
        } else {
          throw new ApolloError('Unknown error');
        }
      }

      if (!userData.workspaces.includes(id)) {
        throw new ForbiddenError('Access denied');
      }

      // We request the data of the workspace
      // with expanded users and projects fields
      try {
        return await Workspace.findById(id)
          .populate([
            {
              path: 'users',
              model: 'User'
            },
            {
              path: 'projects',
              model: 'Project'
            }
          ]);
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
     * @param {ResolverArgs} _args
     * @param {String} _args.name - workspace name
     * @param {String} _args.description - workspace description
     * @param {String} _args.image - workspace image
     * @param {Context}
     * @return {String} created workspace id
     */
    async createWorkspace(_obj, { name, description, image }, { user }) {
      if (user && !user.id) {
        throw new ForbiddenError('Only authorized users can do this');
      }

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
    },

    /**
     * Joining workspace by current user
     * @param {ResolverObj} _obj
     * @param {ResolverArgs} _args
     * @param {String} _args.id - joined workspace id
     * @param {Context}
     * @return {Boolean} - returns true if success
     */
    async joinWorkspace(_obj, { id }, { user }) {
      if (user && !user.id) {
        throw new ForbiddenError('Only authorized users can do this');
      }

      let userId = user.id;
      let workspaceId = id;
      let workspace;

      // Check workspace existence
      try {
        workspace = await Workspace.findById(workspaceId);
      } catch (err) {
        console.error('Error: ', err);
        if (err instanceof MongoError) {
          throw new ApolloError('Something went wrong');
        }
        if (err instanceof CastError) {
          throw new ApolloError('Error! Invalid id');
        }

        throw new ApolloError('Unknown error');
      }

      if (!workspace) {
        throw new ApolloError('Error! No workspace found');
      }

      // Check that the user is not yet a member of workpace
      if (workspace.users && workspace.users.includes(userId)) {
        throw new ApolloError('Error! Workspace already joined');
      }

      // Update at the same time workspace and user models
      try {
        await Promise.all([
          User.findByIdAndUpdate(userId, {
            $push: {
              workspaces: workspaceId
            }
          }),
          Workspace.findByIdAndUpdate(workspaceId, {
            $push: {
              users: userId
            }
          })
        ]);

        return true;
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
