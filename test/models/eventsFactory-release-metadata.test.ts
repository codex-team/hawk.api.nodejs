import '../../src/env-test';
import { ObjectId } from 'mongodb';

const collectionMock = {
  aggregate: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
};
const loadEvent = jest.fn();

jest.mock('../../src/redisHelper', () => ({
  __esModule: true,
  default: { getInstance: (): object => ({}) },
}));

jest.mock('../../src/services/chartDataService', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../src/dataLoaders', () => ({
  createProjectEventsByIdLoader: (): { load: jest.Mock } => ({ load: loadEvent }),
}));

jest.mock('../../src/mongo', () => ({
  databases: {
    events: { collection: jest.fn(() => collectionMock) },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const EventsFactory = require('../../src/models/eventsFactory');

const lifecycle = {
  resolvedInRelease: 'hotfix / opaque+name',
  regressionInRelease: 'canary build:abc',
};

describe('EventsFactory release metadata', () => {
  const projectId = '507f1f77bcf86cd799439011';
  const original = {
    _id: new ObjectId(),
    groupHash: 'group-1',
    timestamp: 100,
    payload: {
      title: 'Error',
      release: 'original / build+7',
    },
    ...lifecycle,
  };
  const repetition = {
    _id: new ObjectId(),
    groupHash: original.groupHash,
    timestamp: 200,
    delta: JSON.stringify({ release: [original.payload.release, 'repeated / build+8'] }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    loadEvent.mockResolvedValue(Object.freeze({
      ...original,
      payload: Object.freeze({ ...original.payload }),
    }));
  });

  it.each([true, false])('preserves grouped metadata in daily events (repetition: %s)', async (hasRepetition) => {
    const factory = new EventsFactory(projectId);

    collectionMock.aggregate.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([ {
        _id: new ObjectId(),
        event: { ...original },
        repetition: hasRepetition ? repetition : undefined,
      } ]),
    });

    const { dailyEvents } = await factory.findDailyEventsPortion();
    const event = dailyEvents[0].event;

    expect(event).toMatchObject(lifecycle);
    expect(event.payload.release).toBe(hasRepetition ? 'repeated / build+8' : original.payload.release);
    expect(event.firstSeenInRelease).toBe(original.payload.release);
    expect(loadEvent).not.toHaveBeenCalled();
    expect(collectionMock.aggregate).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])('preserves grouped metadata in event detail (repetition: %s)', async (hasRepetition) => {
    const factory = new EventsFactory(projectId);

    collectionMock.findOne.mockResolvedValue(repetition);

    const event = await factory.getEventRepetition(
      hasRepetition ? repetition._id : original._id,
      original._id
    );

    expect(event).toMatchObject(lifecycle);
    expect(event.payload.release).toBe(hasRepetition ? 'repeated / build+8' : original.payload.release);
    expect(event.firstSeenInRelease).toBe(original.payload.release);
    expect(loadEvent).toHaveBeenCalledTimes(1);
    expect(collectionMock.findOne).toHaveBeenCalledTimes(hasRepetition ? 1 : 0);
  });

  it('preserves grouped metadata for repetitions and the appended original', async () => {
    const factory = new EventsFactory(projectId);
    const cursor = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([ repetition ]),
    };

    collectionMock.find.mockReturnValue(cursor);

    const { repetitions, nextCursor } = await factory.getEventRepetitions(original._id);

    expect(nextCursor).toBeNull();
    expect(repetitions).toHaveLength(2);
    expect(repetitions[0]).toMatchObject({
      ...lifecycle,
      firstSeenInRelease: original.payload.release,
      payload: { release: 'repeated / build+8' },
    });
    expect(repetitions[1]).toMatchObject({
      ...lifecycle,
      firstSeenInRelease: original.payload.release,
      payload: { release: original.payload.release },
    });
    expect(loadEvent).toHaveBeenCalledTimes(1);
    expect(collectionMock.find).toHaveBeenCalledTimes(1);
    expect(original.payload.release).toBe('original / build+7');
  });

  it.each([undefined, null, ''])('retains original release %s instead of a repetition release', (release) => {
    const factory = new EventsFactory(projectId);
    const legacy = {
      _id: original._id,
      timestamp: original.timestamp,
      payload: {
        title: 'Legacy error',
        release,
      },
    };
    const event = factory._composeEventWithRepetition(legacy, {
      ...repetition,
      delta: undefined,
      payload: { release: 'later release' },
    });

    expect(event.firstSeenInRelease).toBeNull();
    expect(event.payload.release).toBe('later release');
    expect(event.resolvedInRelease).toBeNull();
    expect(event.regressionInRelease).toBeNull();
    expect(loadEvent).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, null],
    [null, null],
    ['', null],
    [' \t', null],
    [' NULL ', null],
    [' Undefined\n', null],
    [' nAn ', null],
    [0, '0'],
    [42, '42'],
    [-1.5, '-1.5'],
    [' opaque / Build+7 ', ' opaque / Build+7 '],
    [true, null],
    [ {}, null],
    [ [], null],
    [NaN, null],
    [Infinity, null],
    [-Infinity, null],
  ])('normalizes release metadata %p in every composition path', async (release, expected) => {
    const factory = new EventsFactory(projectId);
    const cachedOriginal = Object.freeze({
      ...original,
      payload: Object.freeze({
        title: 'Error',
        release,
      }),
      resolvedInRelease: release,
      regressionInRelease: release,
      marks: Object.freeze({ resolved: { timestamp: 150 } }),
      assignee: 'owner',
    });
    const selectedRepetition = {
      ...repetition,
      delta: undefined,
      payload: { release: 'later release' },
      resolvedInRelease: 'not original lifecycle',
      regressionInRelease: 'not original lifecycle',
    };

    loadEvent.mockResolvedValue(cachedOriginal);
    collectionMock.findOne.mockResolvedValue(selectedRepetition);
    collectionMock.aggregate.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([undefined, selectedRepetition].map(rep => ({
        _id: new ObjectId(),
        event: cachedOriginal,
        repetition: rep,
      }))),
    });
    collectionMock.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([ selectedRepetition ]),
    });

    const { dailyEvents } = await factory.findDailyEventsPortion();
    const originalDetail = await factory.getEventRepetition(original._id, original._id);
    const repetitionDetail = await factory.getEventRepetition(repetition._id, original._id);
    const { repetitions } = await factory.getEventRepetitions(original._id);
    const events = [
      factory._composeEventWithRepetition(cachedOriginal),
      factory._composeEventWithRepetition(cachedOriginal, selectedRepetition),
      ...dailyEvents.map(({ event }: { event: object }) => event),
      originalDetail,
      repetitionDetail,
      ...repetitions,
    ];

    for (const event of events) {
      expect(event).toMatchObject({
        firstSeenInRelease: expected,
        resolvedInRelease: expected,
        regressionInRelease: expected,
        originalEventId: original._id,
        originalTimestamp: original.timestamp,
        projectId,
        groupHash: original.groupHash,
        marks: cachedOriginal.marks,
        assignee: cachedOriginal.assignee,
      });
      expect(event).not.toBe(cachedOriginal);
    }
    expect(originalDetail.payload.release).toBe(release);
    expect(repetitionDetail.payload.release).toBe('later release');
    expect(cachedOriginal.payload.release).toBe(release);
    expect(cachedOriginal.resolvedInRelease).toBe(release);
    expect(cachedOriginal.regressionInRelease).toBe(release);
    expect(cachedOriginal).not.toHaveProperty('originalEventId');
    expect(cachedOriginal).not.toHaveProperty('firstSeenInRelease');
    expect(cachedOriginal).not.toHaveProperty('projectId');
  });

  describe.each([undefined, null])('original payload is %p', (payload) => {
    it.each([
      {
        format: 'new delta',
        fields: { delta: JSON.stringify({ release: [ 'later release' ] }) },
      },
      {
        format: 'legacy',
        fields: { payload: { release: 'later release' } },
      },
      {
        format: 'unchanged',
        fields: { delta: null },
      },
    ])('safely composes $format repetitions in every path', async ({ format, fields }) => {
      const factory = new EventsFactory(projectId);
      const cachedOriginal = Object.freeze({
        _id: original._id,
        groupHash: original.groupHash,
        timestamp: original.timestamp,
        ...lifecycle,
        ...(payload === null ? { payload: null } : {}),
      });
      const selectedRepetition = {
        _id: repetition._id,
        timestamp: repetition.timestamp,
        ...fields,
      };

      loadEvent.mockResolvedValue(cachedOriginal);
      collectionMock.findOne.mockResolvedValue(selectedRepetition);
      collectionMock.aggregate.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([undefined, selectedRepetition].map(rep => ({
          _id: new ObjectId(),
          event: cachedOriginal,
          repetition: rep,
        }))),
      });
      collectionMock.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([ selectedRepetition ]),
      });

      const { dailyEvents } = await factory.findDailyEventsPortion();
      const originalDetail = await factory.getEventRepetition(original._id, original._id);
      const repetitionDetail = await factory.getEventRepetition(repetition._id, original._id);
      const { repetitions } = await factory.getEventRepetitions(original._id);
      const composed = factory._composeEventWithRepetition(cachedOriginal, selectedRepetition);

      for (const event of [composed, dailyEvents[1].event, repetitionDetail, repetitions[0]]) {
        expect(event).toMatchObject({
          ...lifecycle,
          firstSeenInRelease: null,
          originalEventId: original._id,
          originalTimestamp: original.timestamp,
          _id: repetition._id,
          timestamp: repetition.timestamp,
          projectId,
        });
        expect(event.payload).toEqual(format === 'unchanged' ? {} : { release: 'later release' });
        expect(event.payload.title).toBeUndefined();
      }
      for (const event of [dailyEvents[0].event, originalDetail, repetitions[1]]) {
        expect(event).toMatchObject({
          ...lifecycle,
          firstSeenInRelease: null,
        });
        expect(event.payload).toBe(payload);
      }
      expect(cachedOriginal.payload).toBe(payload);
      expect(cachedOriginal).not.toHaveProperty('originalEventId');
      expect(cachedOriginal).not.toHaveProperty('firstSeenInRelease');
    });
  });

  it('returns null for a missing original on the direct original detail path', async () => {
    const factory = new EventsFactory(projectId);

    loadEvent.mockResolvedValue(null);

    await expect(factory.getEventRepetition(original._id, original._id)).resolves.toBeNull();
    expect(collectionMock.findOne).not.toHaveBeenCalled();
  });
});
