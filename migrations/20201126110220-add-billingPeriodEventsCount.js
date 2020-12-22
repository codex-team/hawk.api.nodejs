/**
 * @file Add billingPeriodEventsCount 0 for each workspace
 */
module.exports = {
  async up(db, client) {
    /**
     * Use one transaction for all requests
     */
    const session = client.startSession();

    console.log('Add billingPeriodEventsCount for existing workspaces...');

    try {
      await session.withTransaction(async () => {
        /**
         * Get all workspaces
         */
        const workspaces = await db.collection('workspaces').find()
          .toArray();

        /**
         * Each workspace should have a billingPeriodEventsCount
         */
        await Promise.all(workspaces.map(async workspace => {
          const workspaceId = workspace._id;

          /**
           * Skip workspaces, which already have plan
           */
          if (workspace.billingPeriodEventsCount) {
            console.log(`Workspace ${workspaceId} already have billingPeriodEventsCount. Skipped.`);

            return Promise.resolve();
          }

          /**
           * Set up default plan
           */
          const result = await db.collection('workspaces').findOneAndUpdate(
            {
              _id: workspace._id,
            },
            {
              $set: { billingPeriodEventsCount: 0 },
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
    /**
     * Use one transaction for all requests
     */
    const session = client.startSession();

    console.log('Start to rollback adding billingPeriodEventsCount for existing workspaces...');

    try {
      await session.withTransaction(async () => {
        /**
         * Find workspaces with a 0 billingPeriodEventsCount
         */
        const workspaces = await db.collection('workspaces').find({
          billingPeriodEventsCount: {
            $eq: 0,
          },
        })
          .toArray();

        /**
         * Remove billingPeriodEventsCount field from workspaces
         */
        await Promise.all(workspaces.map(async workspace => {
          const workspaceId = workspace._id;

          /**
           * Remove billingPeriodEventsCount
           */
          const result = await db.collection('workspaces').findOneAndUpdate(
            {
              _id: workspace._id,
            },
            {
              $unset: { billingPeriodEventsCount: '' },
            }
          );

          if (result.ok === 1) {
            console.log(`Workspace ${workspaceId} now has no billingPeriodEventsCount field`);
          } else {
            console.log(`Workspace ${workspaceId} failed to remove billingPeriodEventsCount field`);
          }

          return result;
        }));
      });
    } finally {
      await session.endSession();
    }
  },
};
