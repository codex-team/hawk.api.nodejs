/**
 * @file Indexes required by promo code validation and reservation flow
 */
module.exports = {
  async up(db) {
    const promoCodes = db.collection('promoCodes');
    const usages = db.collection('promoCodeUsages');

    await promoCodes.createIndex({ value: 1 }, { unique: true });
    await usages.createIndex({ promoCodeId: 1, userId: 1 }, { unique: true });
    await usages.createIndex({ promoCodeId: 1, workspaceId: 1 }, { unique: true });
    await usages.createIndex(
      { transactionId: 1 },
      {
        unique: true,
        partialFilterExpression: { transactionId: { $type: 'string' } },
      }
    );
    await usages.createIndex(
      { promoCodeId: 1, ordinal: 1 },
      {
        unique: true,
        partialFilterExpression: { ordinal: { $type: 'number' } },
      }
    );
    await usages.createIndex({ reservationExpiresAt: 1 }, { expireAfterSeconds: 0 });
  },

  async down(db) {
    await db.collection('promoCodes').dropIndex('value_1');

    const usages = db.collection('promoCodeUsages');

    await usages.dropIndex('promoCodeId_1_userId_1');
    await usages.dropIndex('promoCodeId_1_workspaceId_1');
    await usages.dropIndex('transactionId_1');
    await usages.dropIndex('promoCodeId_1_ordinal_1');
    await usages.dropIndex('reservationExpiresAt_1');
  },
};
