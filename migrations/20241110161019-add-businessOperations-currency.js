module.exports = {
  async up(db, client) {
    /**
     * Use one transaction for all requests
     */
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        const businessOperationsCollection = db.collection('businessOperations');

        await businessOperationsCollection.updateMany(
          {},
          { $set: { 'payload.currency': 'RUB' } } // Set the default value for payload.currency
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
        const businessOperationsCollection = db.collection('businessOperations');

        await businessOperationsCollection.updateMany(
          {},
          { $unset: { 'payload.businessOperations': "" } } // Remove the businessOperations field
        );
      });

    } finally {
      await session.endSession();
    }
  }
};
