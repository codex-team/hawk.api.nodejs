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

  it.each([
    {
      title: 'should clear assignee with null value',
      assignee: null,
      expectResult: true,
    },
    {
      title: 'should clear assignee when assignee is undefined',
      assignee: undefined,
      expectResult: false,
    },
  ])('$title', async ({ assignee, expectResult }) => {
    const factory = new EventsFactory(projectId);
    const a = new ObjectId();

    if (expectResult) {
      collectionMock.updateMany.mockResolvedValue({
        acknowledged: true,
        modifiedCount: 1,
      });
    }

    const result = await factory.bulkUpdateAssignee([ a.toString() ], assignee);

    if (expectResult) {
      expect(result).toEqual({
        acknowledged: true,
        modifiedCount: 1,
      });
    }

    expect(collectionMock.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [ a ] },
        assignee: { $ne: '' },
      },
      { $set: { assignee: '' } }
    );
  });

  it('should deduplicate duplicate event ids before updateMany', async () => {
    const factory = new EventsFactory(projectId);
    const id = new ObjectId();

    await factory.bulkUpdateAssignee([id.toString(), id.toString(), id.toString()], 'user-1');

    const query = collectionMock.updateMany.mock.calls[0][0];

    expect(query._id.$in).toHaveLength(1);
  });
});
