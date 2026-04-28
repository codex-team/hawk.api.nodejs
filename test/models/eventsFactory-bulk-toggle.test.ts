import '../../src/env-test';
import { ObjectId } from 'mongodb';

const collectionMock = {
  find: jest.fn(),
  updateOne: jest.fn(),
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

describe('EventsFactory.bulkToggleEventMark', () => {
  const projectId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
    collectionMock.updateOne.mockResolvedValue({ modifiedCount: 0 });
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
    collectionMock.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const result = await factory.bulkToggleEventMark([ id.toString() ], 'starred');

    expect(result.updatedEventIds).toEqual([ id.toString() ]);
    expect(collectionMock.updateOne).toHaveBeenCalledWith(
      { _id: id },
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
    collectionMock.updateOne.mockResolvedValue({ modifiedCount: 1 });

    await factory.bulkToggleEventMark([ id.toString(), id.toString(), id.toString() ], 'ignored');

    expect(collectionMock.updateOne).toHaveBeenCalledTimes(1);
  });

  it('should list valid but missing document ids in failedEventIds', async () => {
    const factory = new EventsFactory(projectId);
    const missing = new ObjectId();

    collectionMock.find.mockReturnValue({
      toArray: () => Promise.resolve([]),
    });

    const result = await factory.bulkToggleEventMark([ missing.toString() ], 'ignored');

    expect(result.updatedEventIds).toEqual([]);
    expect(result.failedEventIds).toContain(missing.toString());
    expect(collectionMock.updateOne).not.toHaveBeenCalled();
  });

  it('should set mark only on events that do not have it when selection is mixed', async () => {
    const factory = new EventsFactory(projectId);
    const a = new ObjectId();
    const b = new ObjectId();

    collectionMock.find.mockReturnValue({
      toArray: () =>
        Promise.resolve([
          { _id: a, marks: { ignored: 1 } },
          { _id: b, marks: {} },
        ]),
    });
    collectionMock.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const result = await factory.bulkToggleEventMark([ a.toString(), b.toString() ], 'ignored');

    expect(result.updatedEventIds).toEqual([ b.toString() ]);
    expect(collectionMock.updateOne).toHaveBeenCalledTimes(1);
    expect(collectionMock.updateOne).toHaveBeenCalledWith(
      { _id: b },
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
          { _id: a, marks: { resolved: 1 } },
          { _id: b, marks: { resolved: 2 } },
        ]),
    });
    collectionMock.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const result = await factory.bulkToggleEventMark([ a.toString(), b.toString() ], 'resolved');

    expect(result.updatedEventIds).toEqual([ a.toString(), b.toString() ]);
    expect(collectionMock.updateOne).toHaveBeenCalledTimes(2);
    expect(collectionMock.updateOne).toHaveBeenNthCalledWith(1, { _id: a }, { $unset: { 'marks.resolved': '' } });
    expect(collectionMock.updateOne).toHaveBeenNthCalledWith(2, { _id: b }, { $unset: { 'marks.resolved': '' } });
  });

  it('should not remove mark from a subset when only some of the found events have the mark', async () => {
    const factory = new EventsFactory(projectId);
    const a = new ObjectId();
    const b = new ObjectId();

    collectionMock.find.mockReturnValue({
      toArray: () =>
        Promise.resolve([
          { _id: a, marks: { ignored: 1 } },
          { _id: b, marks: {} },
        ]),
    });
    collectionMock.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const result = await factory.bulkToggleEventMark([ a.toString(), b.toString() ], 'ignored');

    expect(result.updatedEventIds).toEqual([ b.toString() ]);
    expect(collectionMock.updateOne).toHaveBeenCalledTimes(1);
    expect(collectionMock.updateOne).toHaveBeenCalledWith(
      { _id: b },
      expect.objectContaining({ $set: { 'marks.ignored': expect.any(Number) } })
    );
  });
});
