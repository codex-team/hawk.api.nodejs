const { ApolloError } = require('apollo-server-express');
const { MongoError } = require('mongodb');
const getFieldName = require('graphql-list-fields');
const Workspace = require('../models/workspace');
const Team = require('../models/team');
const Membership = require('../models/membership');

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
      /*
       * Get models fields requested in query to populate
       */
      const fields = getFieldName(info);

      try {
        const membership = new Membership(user.id);

        return membership.getWorkspaces(ids);
      } catch (err) {
        console.error('Error finding workspace', err);
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
      const ownerId = user.id;

      // @todo make workspace creation via transactions

      try {
        const workspace = await Workspace.create({
          name: name,
          description: description,
          image: image
        });

        const team = new Team(workspace.id);

        await team.addMember(ownerId);

        const membership = new Membership(ownerId);

        await membership.addWorkspace(workspace.id);

        return workspace;
      } catch (err) {
        throw new ApolloError('Something went wrong');
      }
    }
  }
};
