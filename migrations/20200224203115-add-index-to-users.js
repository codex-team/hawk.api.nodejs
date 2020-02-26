/**
 * @file Migration to add unique index for `email` field from users collection
 */
module.exports = {
  async up(db) {
    const collection = db.collection('users');

    await collection.createIndex({
      email: 1,
    }, {
      unique: true,
    });
  },

  async down(db) {
    const collection = db.collection('users');

    await collection.dropIndex({
      email: 1,
    });
  },
};
