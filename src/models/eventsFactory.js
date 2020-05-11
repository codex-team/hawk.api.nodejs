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
 * @typedef {Object} ChartData
 * @property {Number} timestamp - time of midnight
 * @property {String} totalCount - number of errors for this day
 */

/**
 * EventsFactory
 *
 * Factory Class for Event's Model
 */
class EventsFactory extends Factory {
  /**
   * Event types with collections where they stored
   * @return {{EVENTS: string, DAILY_EVENTS: string, REPETITIONS: string}}
   * @constructor
   */
  get TYPES() {
    return {
      EVENTS: 'events',
      REPETITIONS: 'repetitions',
      DAILY_EVENTS: 'dailyEvents',
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
      return new Event(eventSchema);
    });
  }

  /**
   * Find event by id
   *
   * @param {string|ObjectID} id - event's id
   * @returns {Event}
   */
  async findById(id) {
    const searchResult = await this.getCollection(this.TYPES.EVENTS)
      .findOne({
        _id: new ObjectID(id),
      });

    return new Event(searchResult);
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
   * @return {RecentEventSchema[]}
   */
  async findRecent(limit = 10, skip = 0) {
    limit = this.validateLimit(limit);

    const cursor = this.getCollection(this.TYPES.DAILY_EVENTS).aggregate([
      {
        $sort: {
          groupingTimestamp: -1,
          lastRepetitionTime: -1,
        },
      },
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
      },
    ]);

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
   * Fetch timestamps and total count of errors
   * for each day since
   *
   * @param {Number} since - timestamp from which we start taking errors
   * @return {DailyEventInfo[]}
   */
  async findChartData(since) {
    /* eslint-disable */

    console.log('since', since);


    const cursor = this.getCollection(this.TYPES.DAILY_EVENTS).find(
      {
        groupingTimestamp: {
          $gt: since,
        },
      }
    );

    const events = await this.getCollection(this.TYPES.EVENTS).find(
      {
        'payload.timestamp': {
          $gt: since,
        },
      }
    ).toArray();

    const chartData = await cursor.toArray();

    console.log('daily events', chartData);

    events.forEach(event => {

      const eventDate = new Date(event.payload.timestamp * 1000);

      eventDate.setHours(0, 0, 0, 0); // get midnight
      const midnight = eventDate.getTime() / 1000;

      console.log(`${event.payload.timestamp} ${event.groupHash} - ${event.totalCount} - ${midnight}`);
    });

    console.log('\n\n');

    const groupedData = this.groupChartData(chartData);

    console.log('groupedData:\n');
    console.log(groupedData);
    let may2found = groupedData[0].timestamp;



    let ddd = new Date(may2found * 1000);
    console.log('\nday in db -->', ddd , ' in _U_T_C_ --> ', ddd.toUTCString());

    const arr = [];
    const days = 14;
    const now = new Date();

    console.log('\n');
    console.log('Now: ', now,);
    console.log('Now [UTC]: ', now.toUTCString(), '\n');


    // const nowMid      = (new Date(now.getTime())).setHours(0, 0, 0, 0);
    // const nowMidUTC   = (new Date(now.getTime())).setUTCHours(0, 0, 0, 0)
    // const nowMidUTC24 = (new Date(now.getTime())).setUTCHours(24, 0, 0, 0)
    // const nowMid9     = (new Date(now.getTime())).setHours(21, 0, 0, 0)

    function convert(ts){
      let d = new Date(ts * 1000);

      d.setHours(24, 0,0,0);

      return d.getTime() / 1000;
    }

    function convert2(ts){
      let d = new Date(ts * 1000);

      d.setUTCHours(24, 0,0,0);

      return d.getTime() / 1000;
    }

    let tsShouldBe = groupedData.map(item => {
      return convert(item.timestamp)
    });

    console.log('\nTimestamps converted:\n');
    groupedData.forEach(({timestamp}) => {
      console.log(`${timestamp} --> ${convert(timestamp)} =? ${convert2(timestamp)}: ${
        convert(timestamp) === convert2(timestamp)
          ? wrapInColor('yes!', consoleColors.fgGreen)
          : wrapInColor('naa', consoleColors.fgRed)
      }`);
    });
    console.log('\n');



    function isFound(ts) {
      return groupedData.find(item => item.timestamp === ts);
    }

    function isFoundInShouldBe(ts) {
      return tsShouldBe.includes(ts);
    }


    function getDay(todayMid, offset = 0) {
      const oDay = new Date(todayMid);
      const day = oDay.setDate(now.getDate() - offset);
      const dayMid = (new Date(day)) / 1000;

      return dayMid;
    }

    function checkDate(mid, label) {
      let arr = [];

      for (let i = 0; i < days; i++) {
        let dayMid = getDay(mid, i);

        arr.push(dayMid);
      }

      return arr;
    }

    var set = [
      ['00:00 locl', (new Date(now.getTime())).setHours(0, 0, 0, 0)],
      ['00:00 UTC ', (new Date(now.getTime())).setUTCHours(0, 0, 0, 0)],
      ['24:00 UTC ', (new Date(now.getTime())).setUTCHours(24, 0, 0, 0)],
      ['21:00 locl', (new Date(now.getTime())).setHours(21, 0, 0, 0)]
    ]

    let table = [];

    set.forEach(([label, mid]) => {
      table.push(checkDate(mid, label));
    })

    /**
     * Table Header
     */
    let th = 'date  | ';

    set.forEach(([label, _]) => {
      th += label + ' | '
    })

    console.log(th);

    /**
     * Table header delimiter
     */
    let thd = '----- | ';

    set.forEach(([label, _]) => {
      thd += '---------- | '
    })

    console.log(thd);

    for (let i = 0; i < days; i++) {
      let log = '';

      table.forEach((ts, j) => {

        if (j === 0){
          let d = new Date(ts[i] * 1000);
          log += `${d.getDate() > 9 ? d.getDate() : '0' + d.getDate()}/0${d.getMonth() + 1}` + ' | '
        }

        if (isFound(ts[i])) {
          log += wrapInColor(ts[i], consoleColors.fgGreen) + ' | ';
        } else if (isFoundInShouldBe(ts[i])){
          log += wrapInColor(ts[i], consoleColors.fgRed) + ' | ' ;
        } else {
          log += ts[i] + ' | '
        }
      })

      console.log(log);
    }


    /*
    for (let i = 0; i < days; i++) {
      const dayMid = getDay(nowMid, i);
      const dayMidUtc = getDay(nowMidUTC, i);
      const dayMidUtc24 = getDay(nowMidUTC24, i);
      const dayMid9 = getDay(nowMid9, i);


      const dayExist = groupedData.find(item => item.timestamp === dayMid9);

      if (dayExist){
        arr.push(dayExist);
      } else {
        arr.push({
          timestamp: dayMid9,
          totalCount: 0
        })
      }


      if (dayMid === may2found){
        console.log('found! dayMid', may2found);
      }

      if (dayMidUtc === may2found){
        console.log('found! dayMidUtc', may2found);
      }

      if (dayMidUtc24 === may2found){
        console.log('found! dayMidUtc24', may2found);
      }

      if (dayMid9 === may2found){
        console.log('found! dayMid9', may2found);
      }

      console.log(dayMid, ' | ', dayMidUtc, ' | ', dayMidUtc24, ' | ', dayMid9);
    }

    console.log('arr', arr);

     */



    const completedData = this.insertDaysWithoutErrors(groupedData, since);

    // console.log('\ncompletedData', completedData);

    return completedData;
  }

  /**
   * Group data by groupingTimestamp
   *
   * @param {DailyEventInfo[]} chartData - ungrouped events
   * @return {ChartData[]}
   */
  groupChartData(chartData) {
    /**
     * @param {{[key: string]: DailyEventInfo}} objectsByKeyValue
     * @param {DailyEventInfo} obj
     */
    let groupedData = chartData.reduce((objectsByKeyValue, obj) => {
      const groupingKey = 'groupByTimestamp:' + obj.groupingTimestamp;

      objectsByKeyValue[groupingKey] = (objectsByKeyValue[groupingKey] || []).concat(obj);

      return objectsByKeyValue;
    }, {});

    /**
     * Turning it into a ChartData format
     *
     * @param {Array<{groupingTimestamp: number; count: number}[]>} values
     * @param {ChartData[]} groupedData
     * @param {ChartData[]} acc
     * @param {Array<{groupingTimestamp: number; count: number}>} val
     */
    groupedData = Object.values(groupedData).reduce((acc, val) => {
      acc.push({
        timestamp: val[0].groupingTimestamp,
        totalCount: val.reduce((sum, value) => sum + value.count, 0),
      });

      return acc;
    }, [])
      .sort((a, b) => a.timestamp - b.timestamp);

    return groupedData;
  }

  /**
   * Inserts days that don't contain errors
   *
   * @param {ChartData[]} groupedData - grouped events by timestamp
   * @param {Number} since - timestamp from which we start taking errors
   * @return {ChartData[]}
   */
  insertDaysWithoutErrors(groupedData, since) {
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const firstMidnight = (new Date(since * 1000)).setUTCHours(24, 0, 0, 0);
    const data = [];

    for (let time = firstMidnight, index = 0; time < now; time += day) {
      // Сhecks the existence of the day
      if (groupedData[index] && new Date(groupedData[index].timestamp * 1000 + day).getDate() == new Date(time).getDate()) {
        data.push({
          timestamp: Math.floor(time / 1000),
          totalCount: groupedData[index].totalCount,
        });

        index++;
      } else {
        data.push({
          timestamp: Math.floor(time / 1000),
          totalCount: 0,
        });
      }
    }

    return data;
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
}

module.exports = EventsFactory;



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
