/**
 * @file Migration to add indexes for promoCodes and promoCodeUsages collections
 */
module.exports = {
  async up(db) {
    const promoCodes = db.collection('promoCodes');
    const promoCodeUsages = db.collection('promoCodeUsages');

    await promoCodes.createIndex({ value: 1 }, { unique: true });

    await promoCodeUsages.createIndex({ promoCodeId: 1 });
    await promoCodeUsages.createIndex({ promoCodeId: 1, userId: 1 }, { unique: true });
    await promoCodeUsages.createIndex({ promoCodeId: 1, workspaceId: 1 }, { unique: true });
    await promoCodeUsages.createIndex({ workspaceId: 1 });
    await promoCodeUsages.createIndex({ userId: 1 });
  },

  async down(db) {
    const promoCodes = db.collection('promoCodes');
    const promoCodeUsages = db.collection('promoCodeUsages');

    await promoCodes.dropIndex('value_1');
    await promoCodeUsages.dropIndex('promoCodeId_1');
    await promoCodeUsages.dropIndex('promoCodeId_1_userId_1');
    await promoCodeUsages.dropIndex('promoCodeId_1_workspaceId_1');
    await promoCodeUsages.dropIndex('workspaceId_1');
    await promoCodeUsages.dropIndex('userId_1');
  },
};
