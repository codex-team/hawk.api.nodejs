const AsyncIteratorForEmitter = require('./asyncIteratorForEmitter');

/**
 * An array of aggregation pipeline stages through which to pass change stream documents.
 * This allows for filtering (using $match) and manipulating the change stream documents.
 */
const pipeline = [
  {
    $match: { operationType: 'insert' }
  },
  {
    $addFields: {
      'fullDocument.id': '$fullDocument._id'
    }
  }
];

/**
 * Controls events streams from project for per user
 */
class MongoWatchController {
  /**
   * Setups watch streams and returns async iterator which will be resolved when event will come
   * Used to implement user subscriptions for updating the event list
   * @param {String} collectionsResolver - resolver that returns collections to observe
   * @return {AsyncIterator<EventSchema>}
   */
  getAsyncIteratorForCollectionChangesEvents(collectionsResolver) {
    const emitterPromise = new Promise(async resolve => {
      const collection = await collectionsResolver;

      resolve(new MongoCollectionsChangedEmitter(collection));
    });

    return new AsyncIteratorForEmitter(emitterPromise, 'change');
  }
}

/**
 * Emit events when observed collections changed
 */
class MongoCollectionsChangedEmitter {
  /**
   * @param {Promise<Collection>} collections - collections to observe
   */
  constructor(collections) {
    this.changeStreams = collections.map(collection => collection.watch(pipeline));
  }

  /**
   * Adds the handler function for the event named eventName
   * @param {String} eventName - event name to subscribe
   * @param {function} handler - event handler
   */
  on(eventName, handler) {
    this.changeStreams.forEach(stream => stream.on(eventName, handler));
  }

  /**
   * Closes all changeStreams inside of event emitter
   */
  close() {
    this.changeStreams.forEach(stream => stream.close());
  }
}

module.exports = MongoWatchController;
