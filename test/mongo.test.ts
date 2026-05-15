const connectMock = jest.fn();
const closeMock = jest.fn().mockResolvedValue(undefined);

jest.mock('mongodb', () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect: connectMock,
    close: closeMock,
    db: jest.fn().mockReturnValue({ databaseName: 'test' }),
    on: jest.fn(),
  })),
}));

jest.mock('@hawk.so/nodejs', () => ({
  __esModule: true,
  default: { send: jest.fn() },
}));

jest.mock('../src/metrics', () => ({
  setupMongoMetrics: jest.fn(),
  withMongoMetrics: (options: Record<string, unknown>): Record<string, unknown> => options,
}));

/**
 * Loads a fresh copy of src/mongo with the given retry env vars applied.
 *
 * @param tries - value for MONGO_RECONNECT_TRIES
 * @returns the freshly required mongo module
 */
function loadMongo(tries: number): typeof import('../src/mongo') {
  jest.resetModules();
  process.env.MONGO_RECONNECT_TRIES = String(tries);
  process.env.MONGO_RECONNECT_INTERVAL = '1';

  return require('../src/mongo');
}

describe('mongo connection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('retries on failure and connects when a later attempt succeeds', async () => {
    connectMock
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue(undefined);

    const mongo = loadMongo(3);

    await expect(mongo.setupConnections()).resolves.toBeUndefined();
    expect(mongo.databases.hawk).not.toBeNull();
    expect(mongo.databases.events).not.toBeNull();
  });

  test('rejects after exhausting MONGO_RECONNECT_TRIES attempts', async () => {
    connectMock.mockRejectedValue(new Error('down'));

    const mongo = loadMongo(3);

    await expect(mongo.setupConnections()).rejects.toThrow(/failed after 3 attempts/);
    /** 3 tries per client, hawk + events run in parallel */
    expect(connectMock).toHaveBeenCalledTimes(6);
  });

  test('closeConnections closes clients and nulls exported handles', async () => {
    connectMock.mockResolvedValue(undefined);

    const mongo = loadMongo(3);

    await mongo.setupConnections();
    await mongo.closeConnections();

    expect(closeMock).toHaveBeenCalledTimes(2);
    expect(mongo.databases.hawk).toBeNull();
    expect(mongo.databases.events).toBeNull();
    expect(mongo.mongoClients.hawk).toBeNull();
    expect(mongo.mongoClients.events).toBeNull();
  });
});
