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

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const EventsFactory = require('../../src/models/eventsFactory') as any;

describe('EventsFactory.bulkToggleEventMark', () => {
  const projectId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 0,
    });
  });

  it('should support starred mark', async () => {
    const factory = new EventsFactory(projectId);
    const id = new ObjectId();

    collectionMock.find.mockReturnValue({
      toArray: () =>
        Promise.resolve([
          {
            _id: id,
            marks: {},
          },
        ]),
    });
    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1,
    });

    const result = await factory.bulkToggleEventMark([ id.toString() ], 'starred');

    expect(result).toEqual({
      acknowledged: true,
      modifiedCount: 1,
    });
    expect(collectionMock.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [ id ] },
        'marks.starred': { $exists: false },
      },
      expect.objectContaining({
        $set: { 'marks.starred': expect.any(Number) },
      })
    );
  });

  it('should deduplicate duplicate event ids before applying', async () => {
    const factory = new EventsFactory(projectId);
    const id = new ObjectId();

    collectionMock.find.mockReturnValue({
      toArray: () =>
        Promise.resolve([
          {
            _id: id,
            marks: {},
          },
        ]),
    });
    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1,
    });

    await factory.bulkToggleEventMark([id.toString(), id.toString(), id.toString()], 'ignored');

    const query = collectionMock.updateMany.mock.calls[0][0];

    expect(query._id.$in).toHaveLength(1);
  });

  it('should return success shape even when nothing changed', async () => {
    const factory = new EventsFactory(projectId);
    const id = new ObjectId();

    collectionMock.find.mockReturnValue({
      toArray: () => Promise.resolve([ {
        _id: id,
        marks: { ignored: 1 },
      } ]),
    });
    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 0,
    });

    const result = await factory.bulkToggleEventMark([ id.toString() ], 'ignored');

    expect(result).toEqual({
      acknowledged: true,
      modifiedCount: 0,
    });
  });

  it('should set mark only on events that do not have it when selection is mixed', async () => {
    const factory = new EventsFactory(projectId);
    const a = new ObjectId();
    const b = new ObjectId();

    collectionMock.find.mockReturnValue({
      toArray: () =>
        Promise.resolve([
          {
            _id: a,
            marks: { ignored: 1 },
          },
          {
            _id: b,
            marks: {},
          },
        ]),
    });
    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1,
    });

    await factory.bulkToggleEventMark([a.toString(), b.toString()], 'ignored');

    expect(collectionMock.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [a, b] },
        'marks.ignored': { $exists: false },
      },
      expect.objectContaining({
        $set: { 'marks.ignored': expect.any(Number) },
      })
    );
  });

  it('should remove mark from all when every selected event already has the mark', async () => {
    const factory = new EventsFactory(projectId);
    const a = new ObjectId();
    const b = new ObjectId();

    collectionMock.find.mockReturnValue({
      toArray: () =>
        Promise.resolve([
          {
            _id: a,
            marks: { resolved: 1 },
          },
          {
            _id: b,
            marks: { resolved: 2 },
          },
        ]),
    });
    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 2,
    });

    const result = await factory.bulkToggleEventMark([a.toString(), b.toString()], 'resolved');

    expect(result).toEqual({
      acknowledged: true,
      modifiedCount: 2,
    });
    expect(collectionMock.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [a, b] },
        'marks.resolved': { $exists: true },
      },
      { $unset: { 'marks.resolved': '' } }
    );
  });

  it('should not remove mark from a subset when only some of the found events have the mark', async () => {
    const factory = new EventsFactory(projectId);
    const a = new ObjectId();
    const b = new ObjectId();

    collectionMock.find.mockReturnValue({
      toArray: () =>
        Promise.resolve([
          {
            _id: a,
            marks: { ignored: 1 },
          },
          {
            _id: b,
            marks: {},
          },
        ]),
    });
    collectionMock.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1,
    });

    await factory.bulkToggleEventMark([a.toString(), b.toString()], 'ignored');

    expect(collectionMock.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [a, b] },
        'marks.ignored': { $exists: false },
      },
      expect.objectContaining({ $set: { 'marks.ignored': expect.any(Number) } })
    );
  });
});
