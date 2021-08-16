/**
 * Get date for the current day without hours, minutes and seconds
 * @return {Date}
 */
const getCurrentDay = () => {
  const thisDay = new Date();

  thisDay.setHours(0);
  thisDay.setMinutes(0);
  thisDay.setSeconds(0);
  thisDay.setMilliseconds(0);

  return thisDay;
};

/**
 * @file Add missing lastChargeDate field for workspaces
 */
module.exports = {
  async up(db, client) {
    /**
     * Use one transaction for all requests
     */
    const session = client.startSession();

    console.log('Add missing lastChargeDate field for workspaces...');

    try {
      await session.withTransaction(async () => {
        /**
         * Get all workspaces
         */
        const workspaces = await db.collection('workspaces').find()
          .toArray();

        /**
         * Each workspace should have a lastChargeDate param
         */
        await Promise.all(workspaces.map(async workspace => {
          const workspaceId = workspace._id;

          /**
           * Skip workspaces, which already have plan
           */
          if (workspace.lastChargeDate) {
            console.log(`Workspace ${workspaceId} already have lastChargeDate. Skipped.`);

            return Promise.resolve();
          }

          /**
           * Set up lastChargeDate to current Date
           */
          const result = await db.collection('workspaces').findOneAndUpdate(
            {
              _id: workspace._id,
            },
            {
              $set: {
                lastChargeDate: getCurrentDay(),
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
    /**
     * Use one transaction for all requests
     */
    const session = client.startSession();

    console.log('Start to rollback adding lastChargeDate for existing workspaces...');

    try {
      await session.withTransaction(async () => {
        /**
         * Find workspaces with a 0 billingPeriodEventsCount
         */
        const workspaces = await db.collection('workspaces').find({
          billingPeriodEventsCount: {
            $eq: getCurrentDay(),
          },
        })
          .toArray();

        /**
         * Remove lastChargeDate field from a few workspaces
         */
        await Promise.all(workspaces.map(async workspace => {
          const workspaceId = workspace._id;

          /**
           * Remove lastChargeDate
           */
          const result = await db.collection('workspaces').findOneAndUpdate(
            {
              _id: workspace._id,
            },
            {
              $unset: {
                lastChargeDate: '',
              },
            }
          );

          if (result.ok === 1) {
            console.log(`Workspace ${workspaceId} now has no lastChargeDate field`);
          } else {
            console.log(`Workspace ${workspaceId} failed to remove lastChargeDate field`);
          }

          return result;
        }));
      });
    } finally {
      await session.endSession();
    }
  },
};
