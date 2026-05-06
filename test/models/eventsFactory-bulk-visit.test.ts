import '../../src/env-test';
import { ObjectId } from 'mongodb';

const collectionMock = {
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

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const EventsFactory = require('../../src/models/eventsFactory') as any;

describe('EventsFactory.bulkVisitEvents', () => {
  const projectId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 0,
    });
  });

  it('should use updateMany with visitedBy guard', async () => {
    const factory = new EventsFactory(projectId);
    const a = new ObjectId();
    const b = new ObjectId();
    const userId = new ObjectId();

    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1,
    });

    const result = await factory.bulkVisitEvents([a.toString(), b.toString()], userId.toString());

    expect(collectionMock.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [a, b] },
        visitedBy: { $ne: userId },
      },
      { $addToSet: { visitedBy: userId } }
    );
    expect(result).toEqual({
      acknowledged: true,
      modifiedCount: 1,
    });
  });

  it('should deduplicate ids before updateMany', async () => {
    const factory = new EventsFactory(projectId);
    const id = new ObjectId();

    await factory.bulkVisitEvents([id.toString(), id.toString()], new ObjectId().toString());

    const query = collectionMock.updateMany.mock.calls[0][0];

    expect(query._id.$in).toHaveLength(1);
  });
});
