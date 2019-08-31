const Model = require('./model');
const mongo = require('../mongo');

/**
 * Model representing workspace tariff plan
 *
 * @typedef {object} Plan
 * @property {string} id - plan id
 * @property {string} name - plan name
 * @property {number} monthlyCharge - monthly charge for plan
 * @property {number} eventsLimit - maximum amount of events available for plan
 */
class Plan extends Model {
  /**
   * Model's collection
   * @return {Collection}
   */
  static get collection() {
    return mongo.databases.hawk.collection('plans');
  }

  /**
   * @constructor
   * @param {Plan} planData
   */
  constructor(planData) {
    super();

    const { name, monthlyCharge, eventsLimit, _id } = planData;

    this.id = _id.toString();
    this.name = name;
    this.monthlyCharge = monthlyCharge;
    this.eventsLimit = eventsLimit;
  }

  /**
   * Finds plan by name
   * @param {string} name - plan name
   * @returns {Promise<Plan>}
   */
  static async find(name) {
    return this.findOne({ name });
  }

  /**
   * Find default tariff plan
   * @returns {Promise<Plan>}
   */
  static async getDefaultPlan() {
    return this.findOne({ default: true });
  }
}

module.exports = Plan;
