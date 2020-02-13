/**
 * Allows to get AsyncIterator from custom event emitter when curtain event comes
 */
module.exports = class AsyncIteratorForEmitter {
  /**
   * @param {Promise<EventEmitter>} emitterResolver - event emitter for event listen
   * @param {String} eventName - event name to subscribe
   */
  constructor(emitterResolver, eventName) {
    this.emitterResolver = emitterResolver;
    this.eventName = eventName;

    // contains not called resolvers
    this.pullQueue = [];

    // contains unprocessed events
    this.pushQueue = [];

    // is iterator done his work
    this.done = false;

    // event emitter for subscribing
    this.emitter = null;

    // pushes value from emitter event to the pushQueue or resolves it if pullQueue is not empty
    this.pushValue = async (args) => {
      if (this.pullQueue.length !== 0) {
        const resolver = this.pullQueue.shift();

        resolver(args);
      } else {
        this.pushQueue.push(args);
      }
    };

    // if there are some event in pushQueue -- resolve it. Else push resolver to the pullQueue
    this.pullValue = async () => {
      return new Promise(resolve => {
        if (this.pushQueue.length !== 0) {
          const args = this.pushQueue.shift();

          resolve(args);
        } else {
          this.pullQueue.push(resolve);
        }
      });
    };
  }

  /**
   *  Specifies the default AsyncIterator for this class
   */
  [Symbol.asyncIterator]() {
    return this;
  }

  /**
   * next value of the iterator
   * @return {Promise<{done: boolean, value: *}>}
   */
  async next() {
    if (!this.emitter) {
      this.emitter = await this.emitterResolver;
      this.emitter.on(this.eventName, this.pushValue);
    }

    return {
      done: this.done,
      value: this.done ? undefined : await this.pullValue(),
    };
  }

  /**
   * Called when iterator ends work
   * @return {Promise<{done: boolean}>}
   */
  async return() {
    this.emitter.close();
    this.done = true;

    return { done: this.done };
  }

  /**
   * called when any error occurred
   * @param {Error} error - occurred error
   * @return {Promise<{done: boolean, value: Promise<Error>}>}
   */
  async throw(error) {
    this.emitter.close();
    this.done = true;

    return {
      done: this.done,
      value: Promise.reject(error),
    };
  }
};
