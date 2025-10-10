import { getMidnightWithTimezoneOffset, getUTCMidnight } from '../utils/dates';
import safe from 'safe-regex';

const Factory = require('./modelFactory');
const mongo = require('../mongo');
const Event = require('../models/event');
const { ObjectID } = require('mongodb');
const { composeEventPayloadByRepetition } = require('../utils/merge');

const MAX_DB_READ_BATCH_SIZE = 80000;

/**
 * @typedef {import('mongodb').UpdateWriteOpResult} UpdateWriteOpResult
 */

/**
 * @typedef {Object} EventRepetitionSchema
 * @property {String} _id — repetition's identifier
 * @property {String} groupHash - event's hash. Generates according to the rule described in EventSchema
 * @property {EventPayload} payload - repetition's payload
 * @property {Number} timestamp - repetition's Unix timestamp
 * @property {Number} originalTimestamp - UNIX timestmap of the original event
 * @property {String} originalEventId - id of the original event
 * @property {String} projectId - id of the project, which repetition it is
 */

/**
 * @typedef {Object} EventRepetitionsPortionSchema
 * @property {EventRepetitionSchema[]} repetitions - list of repetitions
 * @property {String | null} nextCursor - pointer to the first repetition of the next portion, null if there are no repetitions left
 */

/**
 * @typedef {Object} DailyEventSchema
 * @property {String} _id - id of the dailyEvent
 * @property {String} groupHash - group hash of the dailyEvent
 * @property {Number} groupingTimestamp - UNIX timestamp that represents the day of dailyEvent
 * @property {Number} affectedUsers - number of users affected this day
 * @property {Number} count - number of events this day
 * @property {String} lastRepetitionId - id of the last repetition this day
 * @property {Number} lastRepetitionTime - UNIX timestamp that represent time of the last repetition this day
 * @property {Event} event - one certain event that represents all of the repetitions this day
 */

/**
 * @typedef {Object} DailyEventsCursor
 * @property {Number} groupingTimestampBoundary - boundary value of groupingTimestamp field of the last event in the portion
 * @property {Number} sortValueBoundary - boundary value of the field by which events are sorted (count/affectedUsers/lastRepetitionTime) of the last event in the portion
 * @property {String} idBoundary - boundary value of _id field of the last event in the portion
 */

/**
 * @typedef {Object} DaylyEventsPortionSchema
 * @property {DailyEventSchema[]} dailyEvents - original event of the daily one
 * @property {DailyEventsCursor | null} nextCursor - object with boundary values of the first event in the next portion
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

    const event = searchResult ? new Event(searchResult) : null;

    return event;
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
   * @param {DailyEventsCursor} paginationCursor - object that contains boundary values of the last event in the previous portion
   * @param {'BY_DATE' | 'BY_COUNT'} sort - events sort order
   * @param {EventsFilters} filters - marks by which events should be filtered
   * @param {String} search - Search query
   *
   * @return {DaylyEventsPortionSchema}
   */
  async findDailyEventsPortion(
    limit = 10,
    paginationCursor = null,
    sort = 'BY_DATE',
    filters = {},
    search = ''
  ) {
    if (typeof search !== 'string') {
      throw new Error('Search parameter must be a string');
    }

    /**
     * Check if pattern is safe RegExp
     */
    if (!safe(search)) {
      throw new Error('Invalid regular expression pattern');
    }

    switch (sort) {
      case 'BY_COUNT':
        sort = 'count';
        break;
      case 'BY_DATE':
        sort = 'lastRepetitionTime';
        break;
      case 'BY_AFFECTED_USERS':
        sort = 'affectedUsers';
        break;
      default:
        sort = 'lastRepetitionTime';
        break;
    }

    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    limit = this.validateLimit(limit);

    const pipeline = [
      {
        $match: paginationCursor ? {
          /**
           * This condition is used for cursor-based pagination
           * We sort result by groupingTimestamp desc, [sort] desc, _id desc
           * So we need to fetch documents that are less than the last document of the previous portion (based on all three conditions)
           */
          $or: [
            {
              /**
               * If groupingTimestamp is less than the cursors one
               * - daily events of the next day
               */
              groupingTimestamp: { $lt: paginationCursor.groupingTimestampBoundary },
            },
            {
              /**
               * If groupingTimestamp equals to the cursor one, but [sort] is less than the cursors one
               * - daily events of the same day, but with less count/affectedUsers/lastRepetitionTime
               */
              $and: [
                { groupingTimestamp: paginationCursor.groupingTimestampBoundary },
                { [sort]: { $lt: paginationCursor.sortValueBoundary } },
              ],
            },
            {
              /**
               * If groupingTimestamp and [sort] equals to the cursors ones, but _id is less or equal to the cursors one
               * - daily events of the same day with the same count/affectedUsers/lastRepetitionTime, but that were created earlier
               */
              $and: [
                { groupingTimestamp: paginationCursor.groupingTimestampBoundary },
                { [sort]: paginationCursor.sortValueBoundary },
                { _id: { $lte: new ObjectID(paginationCursor.idBoundary) } },
              ],
            },
          ],
        } : {},
      },
      {
        $sort: {
          groupingTimestamp: -1,
          [sort]: -1,
          _id: -1,
        },
      },
    ];

    const searchFilter = search.trim().length > 0
      ? {
        $or: [
          {
            'event.payload.title': {
              $regex: escapedSearch,
              $options: 'i',
            },
          },
          {
            'event.payload.backtrace.file': {
              $regex: escapedSearch,
              $options: 'i',
            },
          },
          {
            'event.payload.context': {
              $regex: escapedSearch,
              $options: 'i',
            },
          },
          {
            'event.payload.addons': {
              $regex: escapedSearch,
              $options: 'i',
            },
          },
        ],
      }
      : {};

    const matchFilter = filters
      ? Object.fromEntries(
        Object
          .entries(filters)
          .map(([mark, exists]) => [`event.marks.${mark}`, { $exists: exists } ])
      )
      : {};

    pipeline.push(
      /**
       * Left outer join original event on groupHash field
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
        $lookup: {
          from: 'repetitions:' + this.projectId,
          localField: 'lastRepetitionId',
          foreignField: '_id',
          as: 'repetition',
        },
      },
      /**
       * Desctruct event and repetition arrays since there are only one document in both arrays
       */
      {
        $unwind: '$event',
      },
      {
        $unwind: {
          path: '$repetition',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          ...matchFilter,
          ...searchFilter,
        },
      },
      { $limit: limit + 1 },
      {
        $unset: 'groupHash',
      }
    );

    const cursor = this.getCollection(this.TYPES.DAILY_EVENTS).aggregate(pipeline);
    const result = await cursor.toArray();

    let nextCursor;

    if (result.length === limit + 1) {
      const nextCursorEvent = result.pop();

      nextCursor = {
        groupingTimestampBoundary: nextCursorEvent.groupingTimestamp,
        sortValueBoundary: nextCursorEvent[sort],
        idBoundary: nextCursorEvent._id.toString(),
      };
    }

    const composedResult = result.map(dailyEvent => {
      const repetition = dailyEvent.repetition;
      const event = dailyEvent.event;

      dailyEvent.event = this._composeEventWithRepetition(event, repetition);
      dailyEvent.id = dailyEvent._id.toString();

      delete dailyEvent.repetition;
      delete dailyEvent._id;

      return dailyEvent;
    });

    return {
      nextCursor: nextCursor,
      dailyEvents: composedResult,
    };
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

    const dailyEventsCursor = await this.getCollection(this.TYPES.DAILY_EVENTS)
      .find(options, {
        projection: {
          lastRepetitionTime: 1,
          groupingTimestamp: 1,
          count: 1,
        },
      })
      .batchSize(MAX_DB_READ_BATCH_SIZE);

    const groupedCounts = {};

    for await (const item of dailyEventsCursor) {
      const groupingTimestamp = getMidnightWithTimezoneOffset(
        item.lastRepetitionTime,
        item.groupingTimestamp,
        timezoneOffset
      );

      const key = `groupingTimestamp:${groupingTimestamp}`;
      const current = groupedCounts[key] || 0;

      if (item.count === undefined || item.count === null) {
        console.warn(`Missing 'count' field for daily event with key ${key}. Defaulting to 0.`);
        groupedCounts[key] = current;
      } else {
        groupedCounts[key] = current + item.count;
      }
    }

    /**
     * Now fill all requested days
     */
    let result = [];

    for (let i = 0; i < days; i++) {
      const now = new Date();
      const day = new Date(now.setDate(now.getDate() - i));
      const dayMidnight = getUTCMidnight(day) / 1000;

      let groupedCount = groupedCounts[`groupingTimestamp:${dayMidnight}`];

      if (!groupedCount) {
        groupedCount = 0;
      }

      result.push({
        timestamp: dayMidnight,
        count: groupedCount,
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
      timestamp: {
        $gt: lastVisit,
      },
    };

    return this.getCollection(this.TYPES.EVENTS)
      .countDocuments(query);
  }

  /**
   * Returns Event repetitions
   *
   * @param {string|ObjectID} eventId - Event's id, could be repetitionId in case when we want to get repetitions portion by one repetition
   * @param {string|ObjectID} originalEventId - id of the original event
   * @param {Number} limit - count limitations
   * @param {Number} cursor - pointer to the next repetition
   *
   * @return {EventRepetitionsPortionSchema}
   */
  async getEventRepetitions(originalEventId, limit = 10, cursor = null) {
    limit = this.validateLimit(limit);

    cursor = cursor ? new ObjectID(cursor) : null;

    const result = {
      repetitions: [],
      nextCursor: null,
    };

    /**
     * Get original event
     * @type {Event}
     */
    const eventOriginal = await this.findById(originalEventId);

    if (!eventOriginal) {
      throw new Error(`Original event not found for ${originalEventId}`);
    }

    /**
     * Get portion based on cursor if cursor is not null
     */
    const query = cursor ? {
      groupHash: eventOriginal.groupHash,
      _id: { $lte: cursor },
    } : {
      groupHash: eventOriginal.groupHash,
    };

    /**
     * Collect repetitions
     * @type {EventRepetitionSchema[]}
     */
    const repetitions = await this.getCollection(this.TYPES.REPETITIONS)
      .find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .toArray();

    if (repetitions.length === limit + 1) {
      result.nextCursor = repetitions.pop()._id;
    }

    for (const repetition of repetitions) {
      const event = this._composeEventWithRepetition(eventOriginal, repetition);

      result.repetitions.push({
        ...event,
        projectId: this.projectId,
      });
    }

    const isLastPortion = result.nextCursor === null;

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
        ...eventOriginal,
        originalTimestamp: eventOriginal.timestamp,
        originalEventId: eventOriginal._id,
        projectId: this.projectId,
      };

      result.repetitions.push(firstRepetition);
    }

    return result;
  }

  /**
   * Returns certain repetition of the original event
   *
   * @param {String} repetitionId - id of Repetition to find
   * @param {String} originalEventId - id of the original event
   * @return {EventRepetitionSchema|null}
   */
  async getEventRepetition(repetitionId, originalEventId) {
    /**
     * If originalEventId equals repetitionId than user wants to get first repetition which is original event
     */
    if (repetitionId === originalEventId) {
      const originalEvent = await this.getCollection(this.TYPES.EVENTS)
        .findOne({
          _id: ObjectID(originalEventId),
        });

      /**
       * All events have same type with originalEvent id
       */
      originalEvent.originalEventId = originalEventId;
      originalEvent.originalTimestamp = originalEvent.timestamp;
      originalEvent.projectId = this.projectId;

      return originalEvent || null;
    }

    /**
     * Otherwise we need to get original event and repetition and merge them
     */
    const repetition = await this.getCollection(this.TYPES.REPETITIONS)
      .findOne({
        _id: ObjectID(repetitionId),
      });

    const originalEvent = await this.getCollection(this.TYPES.EVENTS)
      .findOne({
        _id: ObjectID(originalEventId),
      });

    /**
     * If one of the ids are invalid (originalEvent or repetition not found) return null
     */
    if (!originalEvent || !repetition) {
      throw new Error(`Cant find event repetition for repetitionId: ${repetitionId} and originalEventId: ${originalEventId}`);
    }

    return this._composeEventWithRepetition(originalEvent, repetition);
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

    if (!eventOriginal) {
      return null;
    }

    const release = await mongo.databases.events.collection(this.TYPES.RELEASES).findOne({
      release: eventOriginal.payload.release,
      projectId: this.projectId.toString(),
    });

    return release;
  }

  /**
   * Mark event as visited for passed user
   *
   * @param {string|ObjectId} eventId - id of the original event
   * @param {string|ObjectId} userId - id of the user who is visiting the event
   *
   * @return {Promise<UpdateWriteOpResult>}
   */
  async visitEvent(eventId, userId) {
    const result = await this.getCollection(this.TYPES.EVENTS)
      .updateOne(
        { _id: new ObjectID(eventId) },
        { $addToSet: { visitedBy: new ObjectID(userId) } }
      );

    if (result.matchedCount === 0) {
      throw new Error(`Event not found for eventId: ${eventId}`);
    }

    return result;
  }

  /**
   * Mark or unmark event as Resolved, Ignored or Starred
   *
   * @param {string|ObjectId} eventId - id of the original event to mark
   * @param {string} mark - mark label
   *
   * @return {Promise<UpdateWriteOpResult>}
   */
  async toggleEventMark(eventId, mark) {
    const collection = this.getCollection(this.TYPES.EVENTS);

    const event = await this.findById(eventId);

    if (!event) {
      throw new Error(`Event not found for eventId: ${eventId}`);
    }

    const query = { _id: new ObjectID(event._id) };

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
   * @param {string} eventId - id of the original event to update
   * @param {string} assignee - assignee id for this event
   * @return {Promise<void>}
   */
  async updateAssignee(eventId, assignee) {
    const collection = this.getCollection(this.TYPES.EVENTS);

    const query = { _id: new ObjectID(eventId) };

    const update = {
      $set: { assignee: assignee },
    };

    const result = await collection.updateOne(query, update);

    if (result.updatedCount === 0) {
      throw new Error(`Event not found for eventId: ${eventId}`);
    }

    return result;
  }

  /**
   * Compose event with repetition
   *
   * @param {Event} event - event
   * @param {Repetition|null} repetition - repetition null
   * @returns {Event} event merged with repetition
   */
  _composeEventWithRepetition(event, repetition) {
    if (!repetition) {
      return {
        ...event,
        originalTimestamp: event.timestamp,
        originalEventId: event._id,
        projectId: this.projectId,
      };
    }

    return {
      ...event,
      _id: repetition._id,
      originalTimestamp: event.timestamp,
      originalEventId: event._id,
      timestamp: repetition.timestamp,
      payload: composeEventPayloadByRepetition(event.payload, repetition),
      projectId: this.projectId,
    };
  }
}

module.exports = EventsFactory;
