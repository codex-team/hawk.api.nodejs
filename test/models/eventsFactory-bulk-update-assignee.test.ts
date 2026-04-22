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

describe('EventsFactory.bulkUpdateAssignee', () => {
  const projectId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
    collectionMock.updateMany.mockResolvedValue({ modifiedCount: 0 });
  });

  it('should return failed ids for invalid ObjectIds and skip updateMany', async () => {
    const factory = new EventsFactory(projectId);
    const result = await factory.bulkUpdateAssignee([ 'bad-id' ], 'user-1');

    expect(result.updatedCount).toBe(0);
    expect(result.updatedEventIds).toEqual([]);
    expect(result.failedEventIds).toEqual([ 'bad-id' ]);
    expect(collectionMock.updateMany).not.toHaveBeenCalled();
  });

  it('should update only events with changed assignee', async () => {
    const factory = new EventsFactory(projectId);
    const a = new ObjectId();
    const b = new ObjectId();

    collectionMock.find.mockReturnValue({
      toArray: () => Promise.resolve([
        { _id: a, assignee: 'user-1' },
        { _id: b, assignee: '' },
      ]),
    });
    collectionMock.updateMany.mockResolvedValue({ modifiedCount: 1 });

    const result = await factory.bulkUpdateAssignee([ a.toString(), b.toString() ], 'user-1');

    expect(result.updatedCount).toBe(1);
    expect(result.updatedEventIds).toEqual([ b.toString() ]);
    expect(result.failedEventIds).toEqual([]);
    expect(collectionMock.updateMany).toHaveBeenCalledTimes(1);
  });

  it('should clear assignee with null value', async () => {
    const factory = new EventsFactory(projectId);
    const a = new ObjectId();

    collectionMock.find.mockReturnValue({
      toArray: () => Promise.resolve([{ _id: a, assignee: 'user-1' }]),
    });
    collectionMock.updateMany.mockResolvedValue({ modifiedCount: 1 });

    const result = await factory.bulkUpdateAssignee([ a.toString() ], null);

    expect(result.updatedCount).toBe(1);
    expect(result.updatedEventIds).toEqual([ a.toString() ]);
    expect(collectionMock.updateMany).toHaveBeenCalledWith(
      { _id: { $in: [ a ] } },
      { $set: { assignee: '' } }
    );
  });
});
