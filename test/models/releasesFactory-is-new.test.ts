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
  projection: { release: 1, _id: 0 },
  hint: { projectId: 1, release: 1 },
};

describe('ReleasesFactory.isNewInLatestRelease', () => {
  let findOne: jest.Mock;
  let db: Db;
  let factory: ReleasesFactory;

  beforeEach(() => {
    findOne = jest.fn().mockResolvedValue({ release: latestName });
    db = { collection: () => ({ findOne }) } as unknown as Db;
    factory = new ReleasesFactory(db);
  });

  it.each([undefined, null, '', ' ', ' NULL ', 'undefined', 'NaN', NaN, Infinity, -Infinity, true, {}, []])(
    'returns false without reading releases for invalid first-seen name %p', async (name) => {
      expect(await factory.isNewInLatestRelease(projectId, name)).toBe(false);
      expect(findOne).not.toHaveBeenCalled();
    }
  );

  it.each([undefined, null, ''])('returns false without reading releases for missing project %p', async (project) => {
    expect(await factory.isNewInLatestRelease(project, latestName)).toBe(false);
    expect(findOne).not.toHaveBeenCalled();
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
    findOne.mockResolvedValue({ release: latest });
    expect(await factory.isNewInLatestRelease(projectId, firstSeen)).toBe(expected);
    expect(findOne).toHaveBeenCalledWith({ projectId }, queryOptions);
  });

  it.each([undefined, null, '', ' ', ' NULL ', 'undefined', 'NaN', NaN, Infinity, -Infinity, true, {}, []])(
    'caches invalid newest release %p without falling back to an older valid document', async (release) => {
      findOne.mockResolvedValueOnce({ release }).mockResolvedValue({ release: latestName });
      expect(await factory.isNewInLatestRelease(projectId, latestName)).toBe(false);
      expect(await factory.isNewInLatestRelease(projectId, latestName)).toBe(false);
      expect(findOne).toHaveBeenCalledTimes(1);
    }
  );

  it('caches a missing release document', async () => {
    findOne.mockResolvedValue(null);
    expect(await factory.isNewInLatestRelease(projectId, latestName)).toBe(false);
    expect(await factory.isNewInLatestRelease(projectId, latestName)).toBe(false);
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight query across 50 rows and ObjectId/string project keys', async () => {
    let resolveLatest!: (doc: { release: string }) => void;

    findOne.mockReturnValue(new Promise(resolve => { resolveLatest = resolve; }));
    const rows = Array.from({ length: 50 }, (_, index) => factory.isNewInLatestRelease(
      index % 2 ? new ObjectId(projectId) : projectId,
      latestName
    ));

    expect(findOne).toHaveBeenCalledTimes(1);
    resolveLatest({ release: latestName });
    expect(await Promise.all(rows)).toEqual(Array(50).fill(true));
    expect(await factory.isNewInLatestRelease(projectId, 'older')).toBe(false);
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('isolates projects and refreshes the cache for a new request factory', async () => {
    findOne.mockResolvedValueOnce({ release: 'a' }).mockResolvedValueOnce({ release: 'b' });
    expect(await factory.isNewInLatestRelease('project-a', 'a')).toBe(true);
    expect(await factory.isNewInLatestRelease('project-b', 'a')).toBe(false);
    expect(await factory.isNewInLatestRelease('project-b', 'b')).toBe(true);
    expect(await factory.isNewInLatestRelease('project-a', 'b')).toBe(false);
    expect(findOne.mock.calls.map(([filter]) => filter)).toEqual([
      { projectId: 'project-a' }, { projectId: 'project-b' },
    ]);

    findOne.mockResolvedValue({ release: 'next' });
    expect(await new ReleasesFactory(db).isNewInLatestRelease('project-a', 'next')).toBe(true);
    expect(findOne).toHaveBeenCalledTimes(3);
  });
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
      { projectId: 1, release: 1 },
      { name: 'projectId_release_unique_idx', unique: true }
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
      { _id: ObjectId.createFromTime(3), projectId, release: 'unseen / Build+9' },
      { _id: ObjectId.createFromTime(1), projectId, release: 'z-older' },
      { _id: ObjectId.createFromTime(2), projectId, release: 'a-observed' },
      ...Array.from({ length: 200 }, (_, index) => ({
        _id: ObjectId.createFromTime(100 + index),
        projectId: 'unrelated-project',
        release: `foreign-${index}`,
      })),
    ]);
    const findOne = jest.spyOn(Collection.prototype, 'findOne');
    const factory = new ReleasesFactory(db);

    expect(await factory.isNewInLatestRelease(projectId, 'a-observed')).toBe(false);
    expect(await factory.isNewInLatestRelease(projectId, 'unseen / Build+9')).toBe(true);
    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith({ projectId }, queryOptions);
    expect((await db.listCollections().toArray()).map(({ name }) => name)).toEqual(['releases']);

    const [filter, options] = findOne.mock.calls[0];
    const explain = await releases.find(filter!, options).limit(1).explain('executionStats');
    const plan = explain.queryPlanner.winningPlan;
    const serializedPlan = JSON.stringify(plan);

    expect(serializedPlan).toContain('"stage":"IXSCAN"');
    expect(serializedPlan).toContain('"indexName":"projectId_release_unique_idx"');
    expect(serializedPlan).toContain('"stage":"SORT"');
    expect(serializedPlan).not.toContain('"stage":"COLLSCAN"');
    expect(serializedPlan).toContain(`"projectId":["[\\"${projectId}\\", \\"${projectId}\\"]"]`);
    expect(explain.executionStats.nReturned).toBe(1);
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

  it.each([undefined, null, ' NaN '])('does not skip an invalid newest document (%p)', async (release) => {
    await db.collection('releases').insertMany([
      { _id: ObjectId.createFromTime(1), projectId, release: 'valid-older' },
      { _id: ObjectId.createFromTime(2), projectId, ...(release === undefined ? {} : { release }) },
    ]);
    const factory = new ReleasesFactory(db);

    expect(await factory.isNewInLatestRelease(projectId, 'valid-older')).toBe(false);
  });
});
