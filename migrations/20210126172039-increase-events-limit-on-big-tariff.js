/**
 * @file Increases events limit for Big tariff plan
 */

module.exports = {
  async up(db) {
    await db.collection('plans').updateOne({ name: 'Big' }, { $set: { eventsLimit: 1000000000 } });
  },

  async down(db) {
    await db.collection('plans').updateOne({ name: 'Big' }, { $set: { eventsLimit: 1000000 } });
  },
};
