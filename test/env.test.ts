import '../src/env-test';

describe('Test environment', () => {
  test('Variable MONGO_HAWK_DB_URL is defined', async () => {
    expect(process.env.MONGO_HAWK_DB_URL).toBeDefined();
  });
});
