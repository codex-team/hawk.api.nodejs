/**
 * Mock for node:util to support Jest with CommonJS require() calls
 * This re-exports util module as node:util
 */
module.exports = require('util');
