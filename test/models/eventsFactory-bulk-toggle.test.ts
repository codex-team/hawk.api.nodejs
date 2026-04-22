import '../../src/env-test';
import { ObjectId } from 'mongodb';

const collectionMock = {
  find: jest.fn(),
  bulkWrite: jest.fn(),
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
    collectionMock.bulkWrite.mockResolvedValue({
      modifiedCount: 0,
      upsertedCount: 0,
      insertedCount: 0,
      matchedCount: 0,
      deletedCount: 0,
    });
  });

  it('should throw when mark is not resolved or ignored', async () => {
    const factory = new EventsFactory(projectId);

    await expect(factory.bulkToggleEventMark([], 'starred' as any)).rejects.toThrow(
      'bulkToggleEventMark: mark must be resolved or ignored'
    );
  });

  it('should reject more than BULK_TOGGLE_EVENT_MARK_MAX unique ids', async () => {
    const factory = new EventsFactory(projectId);
    const max = EventsFactory.BULK_TOGGLE_EVENT_MARK_MAX;
    const ids = Array.from({ length: max + 1 }, (_, i) => `id-${i}`);

    await expect(factory.bulkToggleEventMark(ids, 'ignored')).rejects.toThrow(
      `bulkToggleEventMark: at most ${max} event ids allowed`
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
    collectionMock.bulkWrite.mockResolvedValue({
      modifiedCount: 1,
      upsertedCount: 0,
    });

    await factory.bulkToggleEventMark([ id.toString(), id.toString(), id.toString() ], 'ignored');

    expect(collectionMock.bulkWrite).toHaveBeenCalledTimes(1);
    const ops = collectionMock.bulkWrite.mock.calls[0][0];

    expect(ops).toHaveLength(1);
  });

  it('should return failedEventIds for invalid ObjectIds and skip bulkWrite', async () => {
    const factory = new EventsFactory(projectId);

    const result = await factory.bulkToggleEventMark([ 'not-a-valid-id' ], 'resolved');

    expect(result.updatedCount).toBe(0);
    expect(result.failedEventIds).toContain('not-a-valid-id');
    expect(collectionMock.bulkWrite).not.toHaveBeenCalled();
  });

  it('should list valid but missing document ids in failedEventIds', async () => {
    const factory = new EventsFactory(projectId);
    const missing = new ObjectId();

    collectionMock.find.mockReturnValue({
      toArray: () => Promise.resolve([]),
    });

    const result = await factory.bulkToggleEventMark([ missing.toString() ], 'ignored');

    expect(result.updatedCount).toBe(0);
    expect(result.failedEventIds).toContain(missing.toString());
    expect(collectionMock.bulkWrite).not.toHaveBeenCalled();
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
    collectionMock.bulkWrite.mockResolvedValue({
      modifiedCount: 1,
      upsertedCount: 0,
    });

    const result = await factory.bulkToggleEventMark([ a.toString(), b.toString() ], 'ignored');

    expect(result.updatedCount).toBe(1);
    const ops = collectionMock.bulkWrite.mock.calls[0][0];

    expect(ops).toHaveLength(1);
    expect(ops[0].updateOne.filter._id).toEqual(b);
    expect(ops[0].updateOne.update).toEqual(
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
    collectionMock.bulkWrite.mockResolvedValue({
      modifiedCount: 2,
      upsertedCount: 0,
    });

    const result = await factory.bulkToggleEventMark([ a.toString(), b.toString() ], 'resolved');

    expect(result.updatedCount).toBe(2);
    const ops = collectionMock.bulkWrite.mock.calls[0][0];

    expect(ops).toHaveLength(2);
    expect(ops[0].updateOne.update).toEqual({ $unset: { 'marks.resolved': '' } });
    expect(ops[1].updateOne.update).toEqual({ $unset: { 'marks.resolved': '' } });
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
    collectionMock.bulkWrite.mockResolvedValue({
      modifiedCount: 1,
      upsertedCount: 0,
    });

    const result = await factory.bulkToggleEventMark([ a.toString(), b.toString() ], 'ignored');

    expect(result.updatedCount).toBe(1);
    const ops = collectionMock.bulkWrite.mock.calls[0][0];

    expect(ops).toHaveLength(1);
    expect(ops[0].updateOne.update).toEqual(
      expect.objectContaining({ $set: { 'marks.ignored': expect.any(Number) } })
    );
  });
});
