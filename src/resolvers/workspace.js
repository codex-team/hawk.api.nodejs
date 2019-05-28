const { AppoloError } = require('apollo-server-express');
const { MongoError, CastError } = require('mongodb');
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
     * @return {Promise<User>}
     */
    workspaces: async (_obj, _args, { req }) => {
      if (!req.userId) {
        return null;
      }

      try {
        return (await User.findById(req.userId)
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
        return null;
      }
    },

    /**
     * Returns all user's workspaces
     * @param {ResolverObj} _obj
     * @param {ResolverArgs} _args
     * @param {Context}
     * @return {Promise<User>}
     */
    workspace: async (_obj, { id }, { req }) => {
      if (!req.userId) {
        return null;
      }

      // Check user access to the workspace
      try {
        let user = await User.findById(req.userId);

        if (user.workspaces.indexOf(id) == -1) {
          // Access denied
          return null;
        }
      } catch (err) {
        if (err instanceof MongoError) {
          return null;
        } else {
          throw err;
        }
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
        if (err instanceof MongoError) {
          return 'Error';
        } else {
          throw err;
        }
      }
    }
  },
  Mutation: {
    /**
     * Create new workspace
     * @param {ResolverObj} _obj
     * @param {String} name - workspace name
     * @param {String} image - workspace image
     * @param {Context}
     * @return {Promise<Token>}
     */
    async createWorkspace(_obj, { name, image }, { req }) {
      if (!req.userId) {
        return false;
      }

      // Perhaps here in the future it is worth passing an array of users
      let ownerId = req.userId;

      try {
        // Create new workspace in mongo
        let w = await Workspace.create({
          name: name,
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
        if (err instanceof MongoError) {
          return false;
        } else {
          throw err;
        }
      }
    },

    /**
     * Joining workspace by current user
     * @param {ResolverObj} _obj
     * @param {String} id - joined workspace id
     * @param {Context}
     * @return {Promise<Token>}
     */
    async joinWorkspace(_obj, { id }, { req }) {
      if (!req.userId) {
        return 'Auth error';
      }

      let userId = req.userId;
      let workspaceId = id;
      let workspace;

      // Check workspace existence
      try {
        workspace = await Workspace.findById(workspaceId);
      } catch (err) {
        if (err instanceof MongoError) {
          return null;
        }
        if (err instanceof CastError) {
          return 'Error! Invalid id';
        }
        throw err;
      }

      if (!workspace) {
        return 'Error! No workspace found';
      }

      // Check that the user is not yet a member of workpace
      if (workspace.users && workspace.users.indexOf(userId) !== -1) {
        return 'Error! Workspace already joined';
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

        return 'OK';
      } catch (err) {
        if (err instanceof MongoError) {
          return 'Error!';
        } else {
          throw err;
        }
      }
    }
  }
};
