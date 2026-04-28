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

describe('EventsFactory.bulkUpdateAssignee', () => {
  const projectId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 0,
    });
  });

  it('should update assignee with updateMany', async () => {
    const factory = new EventsFactory(projectId);
    const a = new ObjectId();
    const b = new ObjectId();

    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1,
    });

    const result = await factory.bulkUpdateAssignee([a.toString(), b.toString()], 'user-1');

    expect(result).toEqual({
      acknowledged: true,
      modifiedCount: 1,
    });
    expect(collectionMock.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [a, b] },
        assignee: { $ne: 'user-1' },
      },
      { $set: { assignee: 'user-1' } }
    );
  });

  it('should clear assignee with null value', async () => {
    const factory = new EventsFactory(projectId);
    const a = new ObjectId();

    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1,
    });

    const result = await factory.bulkUpdateAssignee([ a.toString() ], null);

    expect(result).toEqual({
      acknowledged: true,
      modifiedCount: 1,
    });
    expect(collectionMock.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [ a ] },
        assignee: { $ne: '' },
      },
      { $set: { assignee: '' } }
    );
  });
});
