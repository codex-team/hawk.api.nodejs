import { getMidnightWithTimezoneOffset, getUTCMidnight } from '../utils/dates';
import { groupBy } from '../utils/grouper';

const Factory = require('./modelFactory');
const mongo = require('../mongo');
const Event = require('../models/event');
const { ObjectID } = require('mongodb');

/**
 * @typedef {Object} RecentEventSchema
 * @property {Event} event - event model
 * @property {Number} count - recent error occurred count
 * @property {String} data - error occurred date (string)
 */

/**
 * @typedef {Object} EventRepetitionSchema
 * @property {String} _id — repetition's identifier
 * @property {String} groupHash - event's hash. Generates according to the rule described in EventSchema
 * @property {EventPayload} payload - repetition's payload
 */

/**
 * @typedef {Object} EventsFilters
 * @property {boolean} [starred] - if true, events with 'starred' mark should be included to the output
 * @property {boolean} [resolved] - if true, events with 'resolved' should be included to the output
 * @property {boolean} [ignored] - if true, events with 'ignored' mark should be included to the output
 */

/**
 * EventsFactory
 *
 * Factory Class for Event's Model
 */
class EventsFactory extends Factory {
  /**
   * Event types with collections where they stored
   * @return {{EVENTS: string, DAILY_EVENTS: string, REPETITIONS: string, RELEASES: string}}
   * @constructor
   */
  get TYPES() {
    return {
      EVENTS: 'events',
      REPETITIONS: 'repetitions',
      DAILY_EVENTS: 'dailyEvents',
      RELEASES: 'releases',
    };
  }

  /**
   * Creates Event instance
   * @param {ObjectId} projectId - project ID
   */
  constructor(projectId) {
    super();

    if (!projectId) {
      throw new Error('Can not construct Event model, because projectId is not provided');
    }

    this.projectId = projectId;
  }

  /**
   * Returns pointer to the collection
   *
   * @param {String} type - each events in order to optimization holds data in different collections.
   *                      This argument defines which collection need to be used.
   *
   * @returns {String}
   */
  getCollection(type) {
    return mongo.databases.events.collection(
      type + ':' + this.projectId
    );
  }

  /**
   * Is collection of events exists
   *
   * @param {String} type - type of collection to check
   *
   * @return {Promise<boolean>}
   */
  isCollectionExists(type) {
    return mongo.databases.events.listCollections({ name: type + ':' + this.projectId }).hasNext();
  }

  /**
   * Finds events by passed query
   *
   * @param {object} [query={}] - query
   * @param {Number} [limit=10] - query limit
   * @param {Number} [skip=0] - query skip
   * @returns {Event[]} - events matching query
   */
  async find(query = {}, limit = 10, skip = 0) {
    limit = this.validateLimit(limit);
    skip = this.validateSkip(skip);

    const cursor = this.getCollection(this.TYPES.EVENTS)
      .find(query)
      .sort([ ['_id', -1] ])
      .limit(limit)
      .skip(skip);

    const result = await cursor.toArray();

    return result.map(eventSchema => {
      return new Event({
        ...eventSchema,
        projectId: this.projectId,
      });
    });
  }

  /**
   * Find event by id
   *
   * @param {string|ObjectID} id - event's id
   * @returns {Event|null}
   */
  async findById(id) {
    const searchResult = await this.getCollection(this.TYPES.EVENTS)
      .findOne({
        _id: new ObjectID(id),
      });

    return searchResult ? new Event(searchResult) : null;
  }

  /**
   * Find an event by any custom query
   *
   * @param {object} query - any custom mongo query
   * @return {Event}
   */
  async findOneByQuery(query) {
    const searchResult = await this.getCollection(this.TYPES.EVENTS)
      .findOne(query);

    return new Event(searchResult);
  }

  /**
   * Returns events that grouped by day
   *
   * @param {Number} limit - events count limitations
   * @param {Number} skip - certain number of documents to skip
   * @param {'BY_DATE' | 'BY_COUNT'} sort - events sort order
   * @param {EventsFilters} filters - marks by which events should be filtered
   *
   * @return {RecentEventSchema[]}
   */
  async findRecent(
    limit = 10,
    skip = 0,
    sort = 'BY_DATE',
    filters = {}
  ) {
    limit = this.validateLimit(limit);
    sort = sort === 'BY_COUNT' ? 'count' : 'lastRepetitionTime';

    const pipeline = [
      {
        $sort: {
          groupingTimestamp: -1,
          [sort]: -1,
        },
      },
    ];

    /**
     * If some events should be omitted, use alternative pipeline
     */
    if (Object.values(filters).length > 0) {
      pipeline.push(
        /**
         * Lookup events object for each daily event
         */
        {
          $lookup: {
            from: 'events:' + this.projectId,
            localField: 'groupHash',
            foreignField: 'groupHash',
            as: 'event',
          },
        },
        {
          $unwind: '$event',
        },
        /**
         * Match filters
         */
        {
          $match: {
            ...Object.fromEntries(
              Object
                .entries(filters)
                .map(([mark, exists]) => [`event.marks.${mark}`, { $exists: exists } ])
            ),
          },
        },
        { $skip: skip },
        { $limit: limit },
        {
          $group: {
            _id: null,
            dailyInfo: { $push: '$$ROOT' },
            events: { $push: '$event' },
          },
        },
        {
          $unset: 'dailyInfo.event',
        }
      );
    } else {
      pipeline.push(
        { $skip: skip },
        { $limit: limit },
        {
          $group: {
            _id: null,
            groupHash: { $addToSet: '$groupHash' },
            dailyInfo: { $push: '$$ROOT' },
          },
        },
        {
          $lookup: {
            from: 'events:' + this.projectId,
            localField: 'groupHash',
            foreignField: 'groupHash',
            as: 'events',
          },
        }
      );
    }

    const cursor = this.getCollection(this.TYPES.DAILY_EVENTS).aggregate(pipeline);

    const result = (await cursor.toArray()).shift();

    /**
     * aggregation can return empty array so that
     * result can be undefined
     *
     * for that we check result existence
     *
     * extra field `projectId` needs to satisfy GraphQL query
     */
    if (result && result.events) {
      result.events.forEach(event => {
        event.projectId = this.projectId;
      });
    }

    return result;
  }

  /**
   * Fetch timestamps and total count of errors (or target error) for each day since
   *
   * @param {number} days - how many days we need to fetch for displaying in a chart
   * @param {number} timezoneOffset - user's local timezone offset in minutes
   * @param {string} groupHash - event's group hash for showing only target event
   * @return {ProjectChartItem[]}
   */
  async findChartData(days, timezoneOffset = 0, groupHash = '') {
    const today = new Date();
    const since = today.setDate(today.getDate() - days) / 1000;

    /**
     * Compose options for find method
     * @type {{groupingTimestamp: {$gt: number}}}
     */
    const options = {
      groupingTimestamp: {
        $gt: since,
      },
    };

    /**
     * Add eq check if groupHash was passed
     */
    if (groupHash) {
      options.groupHash = {
        $eq: groupHash,
      };
    }

    let dailyEvents = await this.getCollection(this.TYPES.DAILY_EVENTS)
      .find(options)
      .toArray();

    /**
     * Convert UTC midnight to midnights in user's timezone
     */
    dailyEvents = dailyEvents.map((item) => {
      return Object.assign({}, item, {
        groupingTimestamp: getMidnightWithTimezoneOffset(item.lastRepetitionTime, item.groupingTimestamp, timezoneOffset),
      });
    });

    /**
     * Group events using 'groupByTimestamp:NNNNNNNN' key
     * @type {ProjectChartItem[]}
     */
    const groupedData = groupBy('groupingTimestamp')(dailyEvents);

    /**
     * Now fill all requested days
     */
    let result = [];

    for (let i = 0; i < days; i++) {
      const now = new Date();
      const day = new Date(now.setDate(now.getDate() - i));
      const dayMidnight = getUTCMidnight(day) / 1000;
      const groupedEvents = groupedData[`groupingTimestamp:${dayMidnight}`];

      result.push({
        timestamp: dayMidnight,
        count: groupedEvents ? groupedEvents.reduce((sum, value) => sum + value.count, 0) : 0,
      });
    }

    /**
     * Order by time ascendance
     */
    result = result.sort((a, b) => a.timestamp - b.timestamp);

    return result;
  }

  /**
   * Returns number of documents that occurred after the last visit time
   *
   * @param {Number} lastVisit - user's last visit time on project
   *
   * @return {Promise<Number>}
   *
   * @todo move to Project model
   */
  async getUnreadCount(lastVisit) {
    const query = {
      'payload.timestamp': {
        $gt: lastVisit,
      },
    };

    return this.getCollection(this.TYPES.EVENTS)
      .countDocuments(query);
  }

  /**
   * Returns Event repetitions
   *
   * @param {string|ObjectID} eventId - Event's id
   * @param {Number} limit - count limitations
   * @param {Number} skip - selection offset
   *
   * @return {EventRepetitionSchema[]}
   *
   * @todo move to Repetitions(?) model
   */
  async getEventRepetitions(eventId, limit = 10, skip = 0) {
    limit = this.validateLimit(limit);
    skip = this.validateSkip(skip);

    /**
     * Get original event
     * @type {EventSchema}
     */
    const eventOriginal = await this.findById(eventId);

    /**
     * Collect repetitions
     * @type {EventRepetitionSchema[]}
     */
    const repetitions = await this.getCollection(this.TYPES.REPETITIONS)
      .find({
        groupHash: eventOriginal.groupHash,
      })
      .sort({ _id: -1 })
      .limit(limit)
      .skip(skip)
      .toArray();

    const isLastPortion = repetitions.length < limit && skip === 0;

    /**
     * For last portion:
     * add original event to the end of repetitions list
     */
    if (isLastPortion) {
      /**
       * Get only 'repetitions' fields from event to fit Repetition scheme
       * @type {EventRepetitionSchema}
       */
      const firstRepetition = {
        _id: eventOriginal._id,
        payload: eventOriginal.payload,
        groupHash: eventOriginal.groupHash,
      };

      repetitions.push(firstRepetition);
    }

    return repetitions;
  }

  /**
   * Returns Event concrete repetition
   *
   * @param {String} repetitionId - id of Repetition to find
   * @return {EventRepetitionSchema|null}
   *
   * @todo move to Repetitions(?) model
   */
  async getEventRepetition(repetitionId) {
    return this.getCollection(this.TYPES.REPETITIONS)
      .findOne({
        _id: ObjectID(repetitionId),
      });
  }

  /**
   * Return last occurrence of event
   * @param {string} eventId - id of event to find repetition
   * @return {EventRepetitionSchema|null}
   */
  async getEventLastRepetition(eventId) {
    const repetitions = await this.getEventRepetitions(eventId, 1);

    if (repetitions.length === 0) {
      return null;
    }

    return repetitions.shift();
  }

  /**
   * Get a release from corresponding to this event
   *
   * @param {string} eventId - id of event to get the release
   * @returns {Release|null}
   */
  async getEventRelease(eventId) {
    const eventOriginal = await this.findById(eventId);

    const release = await mongo.databases.events.collection(this.TYPES.RELEASES).findOne({
      release: eventOriginal.payload.release,
      projectId: this.projectId.toString(),
    });

    return release;
  }

  /**
   * Mark event as visited for passed user
   *
   * @param {string|ObjectId} eventId
   * @param {string|ObjectId} userId
   *
   * @return {Promise<void>}
   */
  async visitEvent(eventId, userId) {
    return this.getCollection(this.TYPES.EVENTS)
      .updateOne(
        { _id: new ObjectID(eventId) },
        { $addToSet: { visitedBy: new ObjectID(userId) } }
      );
  }

  /**
   * Mark or unmark event as Resolved, Ignored or Starred
   *
   * @param {string|ObjectId} eventId - event to mark
   * @param {string} mark - mark label
   *
   * @return {Promise<void>}
   */
  async toggleEventMark(eventId, mark) {
    const collection = this.getCollection(this.TYPES.EVENTS);
    const query = { _id: new ObjectID(eventId) };

    const event = await collection.findOne(query);
    const markKey = `marks.${mark}`;

    let update;

    if (event.marks && event.marks[mark]) {
      update = {
        $unset: { [markKey]: '' },
      };
    } else {
      update = {
        $set: { [markKey]: Math.floor(Date.now() / 1000) },
      };
    }

    return collection.updateOne(query, update);
  }

  /**
   * Remove all project events
   *
   * @return {Promise<void>}
   */
  async remove() {
    /**
     * Check if collection is existing
     * Drop collection only when it's existing
     */
    if (await this.isCollectionExists(this.TYPES.EVENTS)) {
      await this.getCollection(this.TYPES.EVENTS).drop();
    }

    if (await this.isCollectionExists(this.TYPES.DAILY_EVENTS)) {
      await this.getCollection(this.TYPES.DAILY_EVENTS).drop();
    }

    if (await this.isCollectionExists(this.TYPES.REPETITIONS)) {
      await this.getCollection(this.TYPES.REPETITIONS).drop();
    }
  }

  /**
   * Update assignee to selected event
   *
   * @param {string} eventId - event id
   * @param {string} assignee - assignee id for this event
   * @return {Promise<void>}
   */
  async updateAssignee(eventId, assignee) {
    const collection = this.getCollection(this.TYPES.EVENTS);
    const query = { _id: new ObjectID(eventId) };
    const update = {
      $set: { assignee: assignee },
    };

    return collection.updateOne(query, update);
  }
}

module.exports = EventsFactory;
