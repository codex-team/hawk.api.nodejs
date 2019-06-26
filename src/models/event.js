const mongoose = require('mongoose');

/**
 * Hawk event format
 */
const eventSchema = new mongoose.Schema({
  /**
   * Type of an event
   */
  catcherType: {
    type: String,
    required: true
  },

  /**
   * Event data
   */
  payload: {
    type: {
      /**
       * Event title
       */
      title: {
        type: String,
        required: true
      },

      /**
       * Event datetime
       */
      timestamp: {
        type: Date,
        required: true
      },

      /**
       * Event severity level
       */
      level: {
        type: Number,
        required: true
      },

      /**
       * Event stack array from the latest call to the earliest
       */
      backtrace: [
        {
          /**
           * Source filepath
           */
          file: {
            type: String,
            required: true
          },

          /**
           * Called line
           */
          line: {
            type: Number,
            required: true
          },

          /**
           * Part of source code file near the called line
           */
          sourceCode: [
            {
              /**
               * Line's number
               */
              line: {
                type: String,
                required: true
              },

              /**
               * Line's content
               */
              content: {
                type: String,
                required: true
              }
            }
          ]
        }
      ],

      /**
       * GET params
       */
      get: Object,

      /**
       * POST params
       */
      post: Object,

      /**
       * HTTP headers
       */
      headers: Object,

      /**
       * Source code version identifier
       * Version, modify timestamp or both of them combined
       */
      release: String,

      /**
       * Current authenticated user
       */
      user: {
        id: Number,
        name: String,
        url: String,
        photo: String
      },

      /**
       * Any additional data
       */
      context: Object
    },
    required: true
  }
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
