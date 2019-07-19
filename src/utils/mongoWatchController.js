const Membership = require('../models/membership');
const { ProjectToWorkspace } = require('../models/project');
const mongo = require('../mongo');

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

class MongoWatchController {
  constructor() {
    this.watchingProjects = {};
  }

  async getEventEmitterForUserProjects(userId) {
    const allWorkspaces = await (new Membership(userId)).getWorkspaces();
    const allProjects = [];

    await asyncForEach(allWorkspaces, async workspace => {
      const allProjectsInWorkspace = await new ProjectToWorkspace(workspace.id).getProjects();

      allProjects.push(...allProjectsInWorkspace);
    });
    const changeStreams = [];

    const pipeline = [
      {
        $match: { 'operationType': 'insert' }
      },
      {
        $addFields: {
          'fullDocument.id': '$fullDocument._id'
        }
      }
    ];

    allProjects.forEach(project => {
      const changeStream = mongo.databases.events.collection('events:' + project.id).watch(pipeline);

      changeStreams.push(changeStream);
    });

    return {
      on(eventName, handler) {
        changeStreams.forEach(stream => stream.on(eventName, handler));
      }
    };
  }

  getAsyncIteratorForUserEvents(userId) {
    const pullQueue = [];
    const pushQueue = [];
    let done = false;
    let emitter;

    const pushValue = async (args) => {
      if (pullQueue.length !== 0) {
        const resolver = pullQueue.shift();

        resolver(...args);
      } else {
        pushQueue.push(args);
      }
    };

    const pullValue = async () => {
      if (!emitter) {
        emitter = await this.getEventEmitterForUserProjects(userId);
        emitter.on('change', handler);
      }
      return new Promise((resolve) => {
        if (pushQueue.length !== 0) {
          const args = pushQueue.shift();

          resolve(...args);
        } else {
          pullQueue.push(resolve);
        }
      });
    };

    const handler = (...args) => {
      pushValue(args);
    };

    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: async () => ({
        done,
        value: done ? undefined : await pullValue()
      }),
      return: async () => {
        done = true;
        // emitter[offMethod](event, handler);
        return { done };
      },
      throw: async (error) => {
        done = true;
        return {
          done,
          value: Promise.reject(error)
        };
      }
    };
  }
}

module.exports = MongoWatchController;
