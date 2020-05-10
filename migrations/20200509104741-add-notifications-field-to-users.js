module.exports = {
  /**
   * Set default notifications config to those users who does not have 'notifications' field
   *
   * @param {Db} db - Mongo DB instance
   * @param {MongoClient} client - client that can be used for transactions
   * @returns {Promise<boolean>}
   */
  async up(db, client) {
    /**
     * Use one transaction for all requests
     */
    const session = client.startSession();

    console.log('Start to update users to set default notifications config...');

    try {
      await session.withTransaction(async () => {
        const collection = db.collection('users');
        const users = await collection.find().toArray();

        await Promise.all(users.map(async user => {
          const userName = user.name || user.email || user._id;

          /**
           * Skip those users, who already have notifications settings
           */
          if (user.notifications) {
            console.log(`User ${userName} already have notifications settings. Skipped.`);

            return Promise.resolve();
          }

          const result = await collection.findOneAndUpdate({
            _id: user._id,
          }, {
            $set: {
              notifications: {
                channels: {
                  email: {
                    endpoint: user.email,
                    isEnabled: true,
                  },
                },
                whatToReceive: {
                  IssueAssigning: true,
                  WeeklyDigest: true,
                  SystemMessages: true,
                },
              },
            },
          });

          if (result.ok === 1) {
            console.log(`User ${wrapInColor(userName, consoleColors.fgGreen)} updated`);
          } else {
            console.log(`User ${wrapInColor(userName, consoleColors.fgRed)} failed updating`);
          }

          return result;
        }));
      });
    } finally {
      await session.endSession();
    }

    return true;
  },

  /**
   * Remove notifications field from those users who have the default notifications set
   *
   * @param {Db} db - Mongo DB instance
   * @param {MongoClient} client - client that can be used for transactions
   * @returns {Promise<boolean>}
   */
  async down(db, client) {
    /**
     * Use one transaction for all requests
     */
    const session = client.startSession();

    console.log('Start to rollback users notifications config updating...');

    try {
      await session.withTransaction(async () => {
        const collection = db.collection('users');
        const users = await collection.find({
          'notifications.channels.email': {
            $exists: true,
          },
          'notifications.channels.webPush': {
            $exists: false,
          },
          'notifications.channels.desktopPush': {
            $exists: false,
          },
          'notifications.whatToReceive.IssueAssigning': true,
          'notifications.whatToReceive.WeeklyDigest': true,
          'notifications.whatToReceive.SystemMessages': true,
        }).toArray();

        await Promise.all(users.map(async user => {
          const userName = user.name || user.email || user._id;

          const result = await collection.findOneAndUpdate({
            _id: user._id,
          }, {
            $unset: {
              notifications: '',
            },
          });

          if (result.ok === 1) {
            console.log(`User ${wrapInColor(userName, consoleColors.fgGreen)} updated: notifications removed`);
          } else {
            console.log(`User ${wrapInColor(userName, consoleColors.fgRed)} failed to remove notifications`);
          }

          return result;
        }));
      });
    } finally {
      await session.endSession();
    }

    return true;
  },
};

/**
 * Terminal output colors
 */
const consoleColors = {
  fgCyan: 36,
  fgRed: 31,
  fgGreen: 32,
};

/**
 * Set a terminal color to the message
 *
 * @param {string} msg - text to wrap
 * @param {string} color - color
 * @returns {string}
 */
function wrapInColor(msg, color) {
  return '\x1b[' + color + 'm' + msg + '\x1b[0m';
}
