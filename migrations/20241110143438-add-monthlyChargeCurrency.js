module.exports = {
  async up(db, client) {
    /**
     * Use one transaction for all requests
     */
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        const plansCollection = db.collection('plans');

        await plansCollection.updateMany(
          {},
          { $set: { monthlyChargeCurrency: 'RUB' } } // Set the default value for monthlyChargeCurrency
        );
      });

    } finally {
      await session.endSession();
    }
  },

  async down(db, client) {
    /**
     * Use one transaction for all requests
     */
    const session = client.startSession();

    try {

      await session.withTransaction(async () => {
        const plansCollection = db.collection('plans');

        await plansCollection.updateMany(
          {},
          { $unset: { monthlyChargeCurrency: "" } } // Remove the monthlyChargeCurrency field
        );

      });

    } finally {
      await session.endSession();
    }
  }
};
