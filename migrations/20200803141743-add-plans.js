/**
 * @file Initialize plans collection
 */
module.exports = {
  async up(db) {
    /**
     * Define plans
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
     * Insert plans to DB
     */
    await db.collection('plans').insertMany(plans);

    return true;
  },

  async down(db) {
    /**
     * Drop plans collection
     */
    await db.collection('plans').drop();
  }
};
