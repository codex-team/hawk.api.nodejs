const mongo = require('../mongo');
const { ObjectID } = require('mongodb');

/**
 * @typedef {Object} ProjectToWorkspaceSchema
 * @property {string|ObjectID} id - ProjectWorkspace ID
 * @property {string|ObjectID} projectId - project ID
 * @property {string} [projectUri] - project unique URI
 */

/**
 * ProjectWorkspace model
 * Represents Project-Workspace relationship
 */
class ProjectToWorkspace {
  /**
   * Creates an instance of ProjectToWorkspace
   * @param {string|ObjectID} workspaceId
   */
  constructor(workspaceId) {
    this.workspaceId = new ObjectID(workspaceId);
    this.collection = mongo.databases.hawk.collection(
      'projects:' + workspaceId
    );
  }

  /**
   * Find ProjectWorkspace
   *
   * @param {object} [query={}] - query
   * @param {number} [limit=10] - query limit
   * @param {number} [skip=0] - query skip
   * @returns {Promise<ProjectToWorkspaceSchema[]>}
   */
  async find(query = {}, limit = 10, skip = 0) {
    const cursor = this.collection
      .find(query)
      .limit(limit)
      .skip(skip);

    return (await cursor.toArray()).map(projectWorkspace => ({
      id: projectWorkspace._id,
      ...projectWorkspace,
    }));
  }

  /**
   * Find projectWorkspace by ID
   *
   * @param {string|ObjectID} projectWorkspaceId
   * @returns {Promise<null|ProjectToWorkspaceSchema>}
   */
  async findById(projectWorkspaceId) {
    const projectWorkspace = await this.collection.findOne({
      _id: new ObjectID(projectWorkspaceId),
    });

    if (!projectWorkspace) {
      return null;
    }

    return {
      id: projectWorkspace._id,
      ...projectWorkspace,
    };
  }

  /**
   * Creates new projects:<workspace._id> document
   *
   * @param {{projectId: ObjectID}} projectToWorkspaceData
   * @returns {Promise<Object>}
   */
  async add(projectToWorkspaceData) {
    const projectToWorkspace = await this.collection.insertOne(
      projectToWorkspaceData
    );

    return {
      id: projectToWorkspace.insertedId,
      ...projectToWorkspace,
    };
  }

  /**
   * Gets projects in workspace.
   * If ids were not passed, returns all projects in workspace.
   *
   * @param {string[]|ObjectID[]} ids - project(s) id(s)
   * @returns {ProjectSchema[]}
   */
  async getProjects(ids = []) {
    ids = ids.map(id => new ObjectID(id));

    const pipleine = [
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'project',
        },
      },
      {
        $unwind: '$project',
      },
      {
        $replaceRoot: {
          newRoot: '$project',
        },
      },
      {
        $addFields: {
          id: '$_id',
        },
      },
    ];

    if (ids.length) {
      return this.collection
        .aggregate([
          {
            $match: {
              projectId: {
                $in: ids,
              },
            },
          },
          ...pipleine,
        ])
        .toArray();
    }

    return this.collection.aggregate(pipleine).toArray();
  }
}

module.exports = ProjectToWorkspace;
