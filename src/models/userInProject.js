const mongo = require('../mongo');

/**
 * User in project model
 * This class works with project's settings
 */
class UserInProject {
  /**
   * @param {String} userId - user's identifier
   * @param {String} projectId - project's identifier
   */
  constructor(userId, projectId) {
    this.userId = userId;
    this.projectId = projectId;
  }

  /**
   * Model's collection
   * @return {Collection}
   */
  get collection() {
    return mongo.databases.hawk.collection('users-in-project:' + this.projectId);
  }

  /**
   * Set's new timestamp when project is visited by user
   */
  updateLastVisit() {
    const now = new Date();

    this.collection.updateOne({
      userId: this.userId
    }, {
      $set: {
        timestamp: now.getTime()
      }
    }, {
      upsert: true
    });
  }

  /**
   * Returns timestamp of last project visit
   *
   * @return {Promise<Number>}
   */
  async getLastVisit() {
    const result = await this.collection.findOne({
      userId: this.userId
    });

    return result.timestamp;
  }
}

module.exports = UserInProject;
