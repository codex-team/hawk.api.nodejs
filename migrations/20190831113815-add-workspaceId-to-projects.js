/**
 * @file Migration to add `workspaceId` field to each document in `projects` collection
 */
const { ObjectID } = require('mongodb');

module.exports = {
  async up(db) {
    const collections = await db.listCollections({ name: /^projects:.*/ }, { nameOnly: true }).toArray();

    const projectsCollection = db.collection('projects');

    const workspaceToproject = {};

    for (const collection of collections) {
      const projects = db.collection(collection.name);
      const workspaceId = collection.name.slice(9);

      workspaceToproject[workspaceId] = [];

      for (const project of (await projects.find({}).toArray())) {
        workspaceToproject[workspaceId].push(project.projectId);
      }
    }

    const bulkOperations = Object.keys(workspaceToproject).reduce((acc, workspaceId) => {
      workspaceToproject[workspaceId].forEach((projectId) => {
        acc.push({
          updateOne: {
            filter: {
              _id: new ObjectID(projectId)
            },
            update: {
              $set: {
                workspaceId: new ObjectID(workspaceId)
              }
            }
          }
        });
      });
      return acc;
    }, []);

    return projectsCollection.bulkWrite(bulkOperations);
  },

  async down(db) {
    return db.collection('projects').updateMany({}, { $unset: { workspaceId: '' } });
  }
};
