import '../../src/env-test';

jest.mock('../../src/redisHelper', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({}),
  },
}));

jest.mock('../../src/services/chartDataService', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(function () {
    return {};
  }),
}));

jest.mock('../../src/dataLoaders', () => ({
  createProjectEventsByIdLoader: () => ({}),
}));

jest.mock('../../src/mongo', () => ({
  databases: {
    events: {
      collection: jest.fn(),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const EventsFactory = require('../../src/models/eventsFactory') as any;

describe('EventsFactory._composeEventWithRepetition', () => {
  const projectId = '507f1f77bcf86cd799439011';
  let factory: any;

  const baseEvent = {
    _id: 'original-event-id',
    groupHash: 'hash',
    totalCount: 5,
    timestamp: 1000,
    payload: { title: 'Test error' },
  };

  beforeEach(() => {
    factory = new EventsFactory(projectId);
  });

  it('should not set count when there is no repetitions', () => {
    const result = factory._composeEventWithRepetition(baseEvent, null);

    expect(result.count).toBeUndefined();
  });

  it('should expose repetition count on the composed result when present', () => {
    const repetition = {
      _id: 'repetition-id',
      timestamp: 2000,
      delta: null,
      count: 7,
    };

    const result = factory._composeEventWithRepetition(baseEvent, repetition);

    expect(result.count).toBe(7);
  });

  it('should leave repetition count undefined when count is not present', () => {
    const repetition = {
      _id: 'repetition-id',
      timestamp: 2000,
      delta: null,
    };

    const result = factory._composeEventWithRepetition(baseEvent, repetition);

    expect(result.count).toBeUndefined();
  });
});
