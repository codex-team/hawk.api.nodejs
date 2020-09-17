/**
 * @file Fix name for workspace property that contains tariff plan id for each workspace
 */
const { ObjectId } = require('mongodb');

module.exports = {
  async up(db, client) {
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        const workspaces = await db.collection('workspaces').find()
          .toArray();

        await Promise.all(workspaces.map(async workspace => {
          const workspaceId = workspace._id;

          const result = await db
            .collection('workspaces')
            .findOneAndUpdate(
              {
                _id: workspaceId,
              },
              {
                $set: { tariffPlanId: new ObjectId(workspace.plan) },
                $unset: {
                  plan: '',
                  /**
                   * planId shouldn't exist at all, but might be added on stage, so we delete it
                   */
                  planId: '',
                },
              }
            );

          if (result.ok === 1) {
            console.log(`Workspace ${workspaceId} updated`);
          } else {
            console.log(`Workspace ${workspaceId} failed updating`);
          }

          return result;
        }));
      });
    } finally {
      await session.endSession();
    }

    return true;
  },

  async down(db, client) {
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        const workspaces = await db.collection('workspaces').find()
          .toArray();

        await Promise.all(workspaces.map(async workspace => {
          const workspaceId = workspace._id;

          const result = await db
            .collection('workspaces')
            .findOneAndUpdate(
              {
                _id: workspaceId,
              },
              {
                $set: { plan: workspace.tariffPlanId.toString() },
                $unset: { tariffPlanId: '' },
              }
            );

          if (result.ok === 1) {
            console.log(`Workspace ${workspaceId} updated`);
          } else {
            console.log(`Workspace ${workspaceId} failed updating`);
          }

          return result;
        }));
      });
    } finally {
      session.endSession();
    }

    return true;
  },
};
