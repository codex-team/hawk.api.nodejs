const path = require('path');
const redisMock = require('redis-mock');

let originalRedisModule = null;
let redisModulePath = null;

/**
 * Create Redis mock client compatible with node-redis v4 API portions we use.
 *
 * @returns {object} mocked redis client
 */
function createMockClient() {
  const client = redisMock.createClient();

  client.isOpen = true;
  client.connect = async () => client;
  client.quit = async () => undefined;
  client.sendCommand = async () => [];
  client.on = () => client;

  return client;
}

/**
 * Install redis-mock into Node's module cache so that `require('redis')`
 * returns the mocked client factory.
 *
 * @returns {object} mock client instance to be reused in tests
 */
function installRedisMock() {
  redisModulePath = require.resolve('redis');
  originalRedisModule = require.cache[redisModulePath] || null;

  const mockExports = {
    createClient: () => createMockClient(),
  };

  require.cache[redisModulePath] = {
    id: redisModulePath,
    filename: redisModulePath,
    loaded: true,
    exports: mockExports,
    path: path.dirname(redisModulePath),
    children: [],
  };

  return mockExports.createClient();
}

/**
 * Restore original `redis` module if it existed.
 */
function uninstallRedisMock() {
  if (!redisModulePath) {
    return;
  }

  if (originalRedisModule) {
    require.cache[redisModulePath] = originalRedisModule;
  } else {
    delete require.cache[redisModulePath];
  }

  originalRedisModule = null;
  redisModulePath = null;
}

module.exports = {
  installRedisMock,
  uninstallRedisMock,
};

