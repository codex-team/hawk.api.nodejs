import { Db, MongoClient, ObjectId } from 'mongodb';
import ReleasesFactory from '../../src/models/releasesFactory';

const projectId = new ObjectId();
let client: MongoClient;
let db: Db;
let factory: ReleasesFactory;

beforeAll(async () => {
  const uri = process.env.MONGO_URL || (global as unknown as { __MONGO_URI__: string }).__MONGO_URI__;

  client = new MongoClient(uri);
  await client.connect();
  db = client.db('latest-release-tests-' + new ObjectId().toHexString());
  factory = new ReleasesFactory(db);
});

beforeEach(async () => {
  await db.collection('releases').deleteMany({});
});

afterAll(async () => {
  try {
    await db?.dropDatabase();
  } finally {
    await client?.close();
  }
});

describe('ReleasesFactory.findLatestName', () => {
  it('returns null for a project without releases', async () => {
    expect(await factory.findLatestName(projectId)).toBeNull();
  });

  it('uses creation order and includes unchecked releases without events, isolated by project', async () => {
    await db.collection('releases').insertMany([
      {
        _id: ObjectId.createFromTime(100),
        projectId: projectId.toString(),
        release: 'z-9.9.9',
        fixChecked: true,
      },
      {
        _id: ObjectId.createFromTime(200),
        projectId: projectId.toString(),
        release: 'a-build/abc#1',
        fixChecked: false,
      },
      {
        _id: ObjectId.createFromTime(500),
        projectId: 'another-project',
        release: 'another-latest',
      },
      ...['', '   ', 'null', ' Undefined ', 'NaN'].map((release, index) => ({
        _id: ObjectId.createFromTime(300 + index),
        projectId: projectId.toString(),
        release,
      })),
    ]);

    expect(await factory.findLatestName(projectId)).toBe('a-build/abc#1');
    expect(await factory.findLatestName('another-project')).toBe('another-latest');
  });

  it('returns null when only missing or placeholder releases exist', async () => {
    await db.collection('releases').insertMany([
      ...[null, '', ' ', 'null', 'undefined', ' NAN '].map(release => ({
        projectId: projectId.toString(),
        release,
      })),
      { projectId: projectId.toString() },
    ]);

    expect(await factory.findLatestName(projectId.toString())).toBeNull();
  });
});
