import '../../src/env-test';
import { ObjectId } from 'mongodb';

const collectionMock = {
  find: jest.fn(),
  updateMany: jest.fn(),
};

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
      collection: jest.fn(() => collectionMock),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any -- CJS class
const EventsFactory = require('../../src/models/eventsFactory') as any;

describe('EventsFactory.bulkVisitEvent', () => {
  const projectId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
    collectionMock.updateMany.mockResolvedValue({ modifiedCount: 0 });
  });

  it('should mark only not-yet-visited events', async () => {
    const factory = new EventsFactory(projectId);
    const a = new ObjectId();
    const b = new ObjectId();
    const userId = new ObjectId();

    collectionMock.find.mockReturnValue({
      toArray: () => Promise.resolve([
        { _id: a, visitedBy: [ userId ] },
        { _id: b, visitedBy: [] },
      ]),
    });
    collectionMock.updateMany.mockResolvedValue({ modifiedCount: 1 });

    const result = await factory.bulkVisitEvent([ a.toString(), b.toString() ], userId.toString());

    expect(result.updatedCount).toBe(1);
    expect(result.updatedEventIds).toEqual([ b.toString() ]);
    expect(result.failedEventIds).toEqual([]);
  });

  it('should add not found ids to failedEventIds', async () => {
    const factory = new EventsFactory(projectId);
    const missing = new ObjectId();

    collectionMock.find.mockReturnValue({
      toArray: () => Promise.resolve([]),
    });

    const result = await factory.bulkVisitEvent([ missing.toString() ], new ObjectId().toString());

    expect(result.updatedCount).toBe(0);
    expect(result.updatedEventIds).toEqual([]);
    expect(result.failedEventIds).toEqual([ missing.toString() ]);
    expect(collectionMock.updateMany).not.toHaveBeenCalled();
  });
});
