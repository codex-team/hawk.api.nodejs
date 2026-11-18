/**
 * @jest-environment @shelf/jest-mongodb/lib/environment
 */
import { Collection, Db, MongoClient, ObjectId } from 'mongodb';
import ReleasesFactory from '../../src/models/releasesFactory';

declare const __MONGO_URI__: string;

const projectId = '507f1f77bcf86cd799439011';
const latestName = ' opaque / Build+7 ';
const queryOptions = {
  sort: { _id: -1 },
  projection: {
    release: 1,
    _id: 0,
  },
  hint: {
    projectId: 1,
    release: 1,
  },
};

describe('ReleasesFactory.isNewInLatestRelease', () => {
  let find: jest.Mock;
  let cursor: {
    next: jest.Mock;
    close: jest.Mock;
    [Symbol.asyncIterator](): AsyncIterableIterator<{ release: unknown }>;
  };
  let factory: ReleasesFactory;
  let cache: Map<string, Promise<string | null>>;

  beforeEach(() => {
    cursor = {
      next: jest.fn().mockResolvedValueOnce({
        value: { release: latestName },
        done: false,
      })
        .mockResolvedValue({ done: true }),
      close: jest.fn().mockResolvedValue(undefined),
      [Symbol.asyncIterator](): AsyncIterableIterator<{ release: unknown }> {
        return this;
      },
    };
    find = jest.fn().mockReturnValue(cursor);
    factory = new ReleasesFactory({ collection: () => ({ find }) } as unknown as Db);
    cache = new Map();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([undefined, null, '', ' ', ' NULL ', 'undefined', 'NaN', NaN, Infinity, -Infinity, true, {}, [] ])(
    'returns false without reading releases for invalid first-seen name %p', async (name) => {
      expect(await factory.isNewInLatestRelease(projectId, name, cache)).toBe(false);
      expect(find).not.toHaveBeenCalled();
    }
  );

  it.each([undefined, null, ''])('returns false without reading releases for missing project %p', async (project) => {
    expect(await factory.isNewInLatestRelease(project, latestName, cache)).toBe(false);
    expect(find).not.toHaveBeenCalled();
  });

  it.each([
    [0, '0', true],
    ['42', 42, true],
    [-1.5, '-1.5', true],
    [latestName, latestName, true],
    [latestName.trim(), latestName, false],
    [latestName.toLowerCase(), latestName, false],
    ['042', 42, false],
    ['older', latestName, false],
  ])('compares normalized first-seen %p with registered %p', async (firstSeen, latest, expected) => {
    cursor.next.mockReset().mockResolvedValueOnce({
      value: { release: latest },
      done: false,
    })
      .mockResolvedValue({ done: true });
    expect(await factory.isNewInLatestRelease(projectId, firstSeen, cache)).toBe(expected);
    expect(find).toHaveBeenCalledWith({ projectId }, queryOptions);
    expect(cursor.close).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, null, '', ' ', ' NULL ', 'undefined', 'NaN', NaN, Infinity, -Infinity, true, {}, [] ])(
    'skips invalid newest release %p and stops at the newest valid name, including numeric zero', async (release) => {
      cursor.next.mockReset()
        .mockResolvedValueOnce({
          value: { release },
          done: false,
        })
        .mockResolvedValueOnce({
          value: { release: 0 },
          done: false,
        })
        .mockResolvedValueOnce({
          value: { release: 'older' },
          done: false,
        });
      expect(await factory.isNewInLatestRelease(projectId, '0', cache)).toBe(true);
      expect(await factory.isNewInLatestRelease(projectId, 'older', cache)).toBe(false);
      expect(find).toHaveBeenCalledTimes(1);
      expect(cursor.next).toHaveBeenCalledTimes(2);
      expect(cursor.close).toHaveBeenCalledTimes(1);
    }
  );

  it.each([ { releases: [] }, { releases: [undefined, null, ' NaN ', {}, true] } ])(
    'caches null and closes an exhausted history $releases', async ({ releases }) => {
      cursor.next.mockReset().mockResolvedValue({ done: true });
      for (const release of releases) {
        cursor.next.mockResolvedValueOnce({
          value: { release },
          done: false,
        });
      }
      expect(await factory.isNewInLatestRelease(projectId, latestName, cache)).toBe(false);
      expect(await factory.isNewInLatestRelease(projectId, latestName, cache)).toBe(false);
      expect(await cache.get(projectId)).toBeNull();
      expect(find).toHaveBeenCalledTimes(1);
      expect(cursor.next).toHaveBeenCalledTimes(releases.length + 1);
      expect(cursor.close).toHaveBeenCalledTimes(1);
    }
  );

  it('shares one in-flight cursor across 50 rows and ObjectId/string project keys', async () => {
    let resolveLatest!: (doc: IteratorResult<{ release: string }>) => void;

    cursor.next.mockReset().mockReturnValueOnce(new Promise(resolve => {
      resolveLatest = resolve;
    }));
    const rows = Array.from({ length: 50 }, (_, index) => factory.isNewInLatestRelease(
      index % 2 ? new ObjectId(projectId) : projectId,
      latestName,
      cache
    ));

    expect(find).toHaveBeenCalledTimes(1);
    expect(cursor.close).not.toHaveBeenCalled();
    resolveLatest({
      value: { release: latestName },
      done: false,
    });
    expect(await Promise.all(rows)).toEqual(Array(50).fill(true));
    expect(await factory.isNewInLatestRelease(projectId, 'older', cache)).toBe(false);
    expect(find).toHaveBeenCalledTimes(1);
    expect(cursor.close).toHaveBeenCalledTimes(1);
  });

  it('isolates projects and refreshes the request cache with the same factory', async () => {
    cursor.next.mockReset()
      .mockResolvedValueOnce({
        value: { release: 'a' },
        done: false,
      })
      .mockResolvedValueOnce({
        value: { release: 'b' },
        done: false,
      })
      .mockResolvedValueOnce({
        value: { release: 'next' },
        done: false,
      });
    expect(await factory.isNewInLatestRelease('project-a', 'a', cache)).toBe(true);
    expect(await factory.isNewInLatestRelease('project-b', 'a', cache)).toBe(false);
    expect(await factory.isNewInLatestRelease('project-b', 'b', cache)).toBe(true);
    expect(await factory.isNewInLatestRelease('project-a', 'b', cache)).toBe(false);
    expect(find.mock.calls.map(([ filter ]) => filter)).toEqual([
      { projectId: 'project-a' }, { projectId: 'project-b' },
    ]);

    expect(await factory.isNewInLatestRelease('project-a', 'next', new Map())).toBe(true);
    expect(await factory.isNewInLatestRelease('project-a', 'a', cache)).toBe(true);
    expect(find).toHaveBeenCalledTimes(3);
  });

  it('reads afresh on every call without a caller-owned cache', async () => {
    cursor.next.mockReset()
      .mockResolvedValueOnce({
        value: { release: latestName },
        done: false,
      })
      .mockResolvedValueOnce({
        value: { release: 'next' },
        done: false,
      });
    expect(await factory.isNewInLatestRelease(projectId, latestName)).toBe(true);
    expect(await factory.isNewInLatestRelease(projectId, 'next')).toBe(true);
    expect(find).toHaveBeenCalledTimes(2);
    expect(cursor.close).toHaveBeenCalledTimes(2);
  });

  it.each(['find throws', 'iteration throws', 'iteration rejects', 'close throws', 'close rejects'])(
    'returns false and logs once for 50 rows when %s, then retries with a fresh request cache', async (failure) => {
      const error = new Error(failure);
      const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      if (failure === 'find throws') {
        find.mockImplementationOnce(() => {
          throw error;
        });
      } else if (failure === 'iteration throws') {
        cursor.next.mockReset().mockImplementationOnce(() => {
          throw error;
        });
      } else if (failure === 'iteration rejects') {
        cursor.next.mockReset().mockRejectedValueOnce(error);
      } else if (failure === 'close throws') {
        cursor.close.mockImplementationOnce(() => {
          throw error;
        });
      } else {
        cursor.close.mockRejectedValueOnce(error);
      }

      const rows = Array.from({ length: 50 }, () => factory.isNewInLatestRelease(projectId, latestName, cache));

      expect(await Promise.all(rows)).toEqual(Array(50).fill(false));
      expect(await cache.get(projectId)).toBeNull();
      expect(find).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith(expect.stringContaining(projectId), error);
      expect(cursor.close).toHaveBeenCalledTimes(failure === 'find throws' ? 0 : 1);

      cursor.next.mockReset().mockResolvedValueOnce({
        value: { release: latestName },
        done: false,
      });
      expect(await factory.isNewInLatestRelease(projectId, latestName, new Map())).toBe(true);
      expect(find).toHaveBeenCalledTimes(2);
      expect(log).toHaveBeenCalledTimes(1);
    }
  );

  it('closes and logs once even if iteration and closing both fail', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    cursor.next.mockReset().mockRejectedValueOnce(new Error('iteration'));
    cursor.close.mockRejectedValueOnce(new Error('close'));
    expect(await factory.isNewInLatestRelease(projectId, latestName, cache)).toBe(false);
    expect(cursor.close).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it.each(['get', 'set', 'rejected promise', 'project key'])(
    'catches unexpected %s failures at the public boundary', async (failure) => {
      const error = new Error(failure);
      const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      let project: string | ObjectId = projectId;

      if (failure === 'get' || failure === 'set') {
        jest.spyOn(cache, failure).mockImplementation(() => {
          throw error;
        });
      } else if (failure === 'rejected promise') {
        cache.set(projectId, Promise.reject(error));
      } else {
        project = new ObjectId(projectId);
        jest.spyOn(project, 'toString').mockImplementation(() => {
          throw error;
        });
      }
      expect(await factory.isNewInLatestRelease(project, latestName, cache)).toBe(false);
      expect(log).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith(expect.any(String), error);
    }
  );
});

describe('ReleasesFactory latest registered release Mongo query', () => {
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    client = await new MongoClient(__MONGO_URI__).connect();
    db = client.db(`test_releases_is_new_${new ObjectId().toHexString()}`);
    /*
     * Reproduce the existing production index only in this isolated test database.
     */
    await db.collection('releases').createIndex(
      {
        projectId: 1,
        release: 1,
      },
      {
        name: 'projectId_release_unique_idx',
        unique: true,
      }
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (db) {
      await db.collection('releases').deleteMany({});
    }
  });

  afterAll(async () => {
    if (db) {
      await db.dropDatabase();
    }
    if (client) {
      await client.close();
    }
  });

  it('uses ObjectId order, includes a release with no occurrences, and bounds the scan to the project', async () => {
    const releases = db.collection('releases');

    await releases.insertMany([
      {
        _id: ObjectId.createFromTime(3),
        projectId,
        release: 'unseen / Build+9',
      },
      {
        _id: ObjectId.createFromTime(1),
        projectId,
        release: 'z-older',
      },
      {
        _id: ObjectId.createFromTime(2),
        projectId,
        release: 'a-observed',
      },
      ...Array.from({ length: 200 }, (_, index) => ({
        _id: ObjectId.createFromTime(100 + index),
        projectId: 'unrelated-project',
        release: `foreign-${index}`,
      })),
    ]);
    const find = jest.spyOn(Collection.prototype, 'find');
    const factory = new ReleasesFactory(db);
    const cache = new Map<string, Promise<string | null>>();

    expect(await factory.isNewInLatestRelease(projectId, 'a-observed', cache)).toBe(false);
    expect(await factory.isNewInLatestRelease(projectId, 'unseen / Build+9', cache)).toBe(true);
    expect(find).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledWith({ projectId }, queryOptions);
    expect((await db.listCollections().toArray()).map(({ name }) => name)).toEqual([ 'releases' ]);

    const [filter, options] = find.mock.calls[0];
    const explain = await releases.find(filter!, options).explain('executionStats');
    const plan = explain.queryPlanner.winningPlan;
    const serializedPlan = JSON.stringify(plan);

    expect(serializedPlan).toContain('"stage":"IXSCAN"');
    expect(serializedPlan).toContain('"indexName":"projectId_release_unique_idx"');
    expect(serializedPlan).toContain('"stage":"SORT"');
    expect(serializedPlan).not.toContain('"stage":"COLLSCAN"');
    expect(serializedPlan).toContain(`"projectId":["[\\"${projectId}\\", \\"${projectId}\\"]"]`);
    /*
     * The application stops at the first valid name; the database still sorts the project's full history.
     */
    expect(explain.executionStats.nReturned).toBe(3);
    expect(explain.executionStats.totalDocsExamined).toBe(3);
    /*
     * A compound-index prefix scan may examine one additional boundary key.
     */
    expect(explain.executionStats.totalKeysExamined).toBeLessThanOrEqual(4);
    console.info('Latest registered release explain:', JSON.stringify({
      plan,
      nReturned: explain.executionStats.nReturned,
      totalDocsExamined: explain.executionStats.totalDocsExamined,
      totalKeysExamined: explain.executionStats.totalKeysExamined,
      totalReleaseDocuments: 203,
    }));
  });

  it.each([undefined, null, ' NaN ', true, {} ])('skips an invalid newest document (%p)', async (release) => {
    await db.collection('releases').insertMany([
      {
        _id: ObjectId.createFromTime(1),
        projectId,
        release: 'valid-older',
      },
      {
        _id: ObjectId.createFromTime(2),
        projectId,
        release: 0,
      },
      {
        _id: ObjectId.createFromTime(3),
        projectId,
        ...(release === undefined ? {} : { release }),
      },
    ]);
    const factory = new ReleasesFactory(db);
    const cache = new Map<string, Promise<string | null>>();

    expect(await factory.isNewInLatestRelease(projectId, '0', cache)).toBe(true);
    expect(await factory.isNewInLatestRelease(projectId, 'valid-older', cache)).toBe(false);
  });

  it.each([ { releases: [] }, { releases: [null, ' NaN ', true] } ])(
    'returns false for absent or all-invalid history $releases', async ({ releases }) => {
      if (releases.length) {
        await db.collection('releases').insertMany(releases.map(release => ({
          projectId,
          release,
        })));
      }
      expect(await new ReleasesFactory(db).isNewInLatestRelease(projectId, 'valid')).toBe(false);
    }
  );
});
