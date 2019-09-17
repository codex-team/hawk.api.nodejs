const mongo = require('../mongo');

/**
 * User in project model
 */
class UserInProject {
  /**
   * @param userId
   * @param projectId
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
   * @return {Promise<void>}
   */
  async updateLastVisit() {
    const now = new Date();

    await this.collection.updateOne({
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
   * Returns timestamp of last visit
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
