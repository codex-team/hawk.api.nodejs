const mongo = require('../mongo');
const Model = require('./model');

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
}

module.exports = UserInProject;
