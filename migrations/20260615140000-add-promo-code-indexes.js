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

    await promoCodes.dropIndex({ value: 1 });
    await promoCodeUsages.dropIndex({ promoCodeId: 1 });
    await promoCodeUsages.dropIndex({ promoCodeId: 1, userId: 1 });
    await promoCodeUsages.dropIndex({ promoCodeId: 1, workspaceId: 1 });
    await promoCodeUsages.dropIndex({ workspaceId: 1 });
    await promoCodeUsages.dropIndex({ userId: 1 });
  },
};
