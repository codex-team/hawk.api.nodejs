const mongo = require('../mongo');
const { ObjectID } = require('mongodb');

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
   *
   * @return {Number}
   */
  updateLastVisit() {
    const time = Date.now() / 1000;

    this.collection.updateOne({
      userId: new ObjectID(this.userId)
    }, {
      $set: {
        timestamp: time
      }
    }, {
      upsert: true
    });

    return time;
  }

  /**
   * Returns timestamp of last project visit
   *
   * @return {Promise<Number>}
   */
  async getLastVisit() {
    const result = await this.collection.findOne({
      userId: new ObjectID(this.userId)
    });

    return result && result.timestamp;
  }

  /**
   * Returns personal notifications settings for user
   * @returns {Promise<NotificationSettingsSchema>}
   */
  async getPersonalNotificationsSettings() {
    const result = await this.collection.findOne({
      userId: new ObjectID(this.userId)
    });

    return result && result.notificationSettings;
  }

  /**
   * Update Notify Settings
   *
   * @param {NotificationSettingsSchema} notificationSettings - settings to update
   * @returns {Promise<Boolean>}
   */
  async updatePersonalNotificationsSettings(notificationSettings) {
    const updated = await this.collection.updateOne(
      { userId: new ObjectID(this.userId) },
      { $set: { notificationSettings } },
      { upsert: true }
    );

    return updated.modifiedCount || updated.upsertedCount || updated.matchedCount;
  }
}

module.exports = UserInProject;
