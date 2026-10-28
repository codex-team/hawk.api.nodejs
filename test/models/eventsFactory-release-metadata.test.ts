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
    loadEvent.mockResolvedValue({ ...original });
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
    if (hasRepetition) {
      expect(event.firstSeenInRelease).toBe(original.payload.release);
    }
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
    if (hasRepetition) {
      expect(event.firstSeenInRelease).toBe(original.payload.release);
    }
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

    expect(event.firstSeenInRelease).toBe(release ?? null);
    expect(event.payload.release).toBe('later release');
    expect(event.resolvedInRelease).toBeUndefined();
    expect(event.regressionInRelease).toBeUndefined();
    expect(loadEvent).not.toHaveBeenCalled();
  });
});
