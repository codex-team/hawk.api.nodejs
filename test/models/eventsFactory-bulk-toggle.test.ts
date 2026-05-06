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

describe('EventsFactory.bulkSetEventMarks', () => {
  const projectId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 0,
    });
  });

  it.each([
    {
      title: 'should set starred mark when enabled is true',
      mark: 'starred',
      enabled: true,
      expectedQuery: {
        markExists: false,
      },
      expectedUpdate: expect.objectContaining({
        $set: { 'marks.starred': expect.any(Number) },
      }),
      expectResult: true,
    },
    {
      title: 'should clear mark when enabled is false',
      mark: 'ignored',
      enabled: false,
      expectedQuery: {
        markExists: true,
      },
      expectedUpdate: { $unset: { 'marks.ignored': '' } },
      expectResult: false,
    },
  ])('$title', async ({ mark, enabled, expectedQuery, expectedUpdate, expectResult }) => {
    const factory = new EventsFactory(projectId);
    const id = new ObjectId();

    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1,
    });

    const result = await factory.bulkSetEventMarks([ id.toString() ], mark, enabled);

    if (expectResult) {
      expect(result).toEqual({
        acknowledged: true,
        modifiedCount: 1,
      });
    }

    expect(collectionMock.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [ id ] },
        [`marks.${mark}`]: { $exists: expectedQuery.markExists },
      },
      expectedUpdate
    );
  });

  it('should deduplicate duplicate event ids before applying', async () => {
    const factory = new EventsFactory(projectId);
    const id = new ObjectId();

    await factory.bulkSetEventMarks([ id.toString(), id.toString(), id.toString() ], 'ignored', true);

    const query = collectionMock.updateMany.mock.calls[0][0];

    expect(query._id.$in).toHaveLength(1);
  });

  it('should return success shape even when nothing changed', async () => {
    const factory = new EventsFactory(projectId);
    const id = new ObjectId();

    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 0,
    });

    const result = await factory.bulkSetEventMarks([ id.toString() ], 'ignored', true);

    expect(result).toEqual({
      acknowledged: true,
      modifiedCount: 0,
    });
  });
});
