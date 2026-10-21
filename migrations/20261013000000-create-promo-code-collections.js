/**
 * Create promo code collections and prevent repeated use by a user or workspace.
 * MongoDB creates the collections when their indexes are created.
 */
module.exports = {
  /**
   * Create unique indexes for promo codes and successful redemptions.
   *
   * @param {Db} db - MongoDB database receiving the promo code indexes.
   * @returns {Promise<void>} Resolves when all indexes have been created.
   */
  async up(db) {
    await db.collection('promoCodes').createIndex({
      value: 1,
    }, {
      name: 'promoCode',
      unique: true,
    });

    await db.collection('promoCodeRedemptions').createIndex({
      promoCodeId: 1,
      userId: 1,
    }, {
      name: 'promoCodeUser',
      unique: true,
    });

    await db.collection('promoCodeRedemptions').createIndex({
      promoCodeId: 1,
      workspaceId: 1,
    }, {
      name: 'promoCodeWorkspace',
      unique: true,
    });
  },

  /**
   * Remove the promo code indexes while preserving collection data.
   *
   * @param {Db} db - MongoDB database containing the promo code indexes.
   * @returns {Promise<void>} Resolves when all indexes have been removed.
   */
  async down(db) {
    await db.collection('promoCodeRedemptions').dropIndex('promoCodeWorkspace');
    await db.collection('promoCodeRedemptions').dropIndex('promoCodeUser');
    await db.collection('promoCodes').dropIndex('promoCode');
  },
};
