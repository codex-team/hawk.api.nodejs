/**
 * This migration fixes dropped user notifications settings which can happen after profile update
 * @see https://github.com/codex-team/hawk.api.nodejs/issues/395
 */
module.exports = {
  /**
   * Add dropped 'isEnabled' and 'whatToReceive' fields
   */
  async up(db) {
    await db
      .getCollection('users')
      .updateMany(
        {
          'notifications.channels.email.isEnabled': { $exists: false }
        },
        {
          $set: {
            'notifications.channels.email.isEnabled': true,
            'notifications.whatToReceive': { IssueAssigning: true, WeeklyDigest: true, SystemMessages: true }
          }
        }
      );
  },

  /**
   * Rollback adding of dropped 'isEnabled' and 'whatToReceive' fields
   */
  async down(db) {
    await db
      .getCollection('users')
      .updateMany(
        {
          'notifications.channels.email.isEnabled': { $exists: false}
        },
        {
          $unset: {
            'notifications.channels.email.isEnabled': '',
            'notifications.whatToReceive': ''
          }
        }
      );
  }
};
