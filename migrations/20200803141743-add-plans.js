/**
 * @file Initialize plans collection and set default plan for each workspace
 */
module.exports = {
  async up(db, client) {
    /**
     * Define initial plans
     * @type {{isDefault: boolean, eventsLimit: number, monthlyCharge: number, name: string}[]}
     */
    const plans = [
      {
        name: 'Startup',
        monthlyCharge: 0,
        eventsLimit: 10000,
        isDefault: true
      },
      {
        name: 'Basic',
        monthlyCharge: 20,
        eventsLimit: 100000,
        isDefault: false
      },
      {
        name: 'Big',
        monthlyCharge: 200,
        eventsLimit: 1000000,
        isDefault: false
      }
    ]

    /**
     * Use one transaction for all requests
     */
    const session = client.startSession();

    console.log('Start to create plans and set default plans for existing workspaces...');

    try {
      await session.withTransaction(async () => {
        /**
         * Insert plans to DB
         */
        await db.collection('plans').insertMany(plans);

        /**
         * Set up sort index by the field isDefault from true to false
         */
        await db.collection('plans').createIndex({ isDefault: -1 })

        /**
         * Get default plan data
         * @type {PlanDBScheme}
         */
        const defaultPlan = await db.collection('plans').findOne({
          isDefault: true
        });

        /**
         * Get all workspaces
         */
        const workspaces = await db.collection('workspaces').find().toArray();

        /**
         * Each workspace should have a plan
         */
        await Promise.all(workspaces.map(async workspace => {
          const workspaceId = workspace._id;

          /**
           * Skip workspaces, which already have plan
           */
          if (workspace.plan) {
            console.log(`Workspace ${workspaceId} already have plan. Skipped.`);

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
              $set: { plan: defaultPlan._id.toString() },
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

    console.log('Start to rollback setting default plans for existing workspaces...');

    try {
      await session.withTransaction(async () => {
        /**
         * Drop plans collection
         */
        await db.collection('plans').drop();

        /**
         * Find workspaces with a plan
         */
        const workspaces = await db.collection('workspaces').find({
          plan: {
            $exists: true
          }
        }).toArray();

        /**
         * Remove plans from workspaces
         */
        await Promise.all(workspaces.map(async workspace => {
          const workspaceId = workspace._id;

          /**
           * Remove plan
           */
          const result = await db.collection('workspaces').findOneAndUpdate(
            {
              _id: workspace._id,
            },
            {
              $unset: { plan: '' },
            }
          );

          if (result.ok === 1) {
            console.log(`Workspace ${workspaceId} now has no plan`);
          } else {
            console.log(`Workspace ${workspaceId} failed to remove a plan`);
          }

          return result;
        }));
      });
    } finally {
      await session.endSession();
    }
  }
};
