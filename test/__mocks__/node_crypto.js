/**
 * Mock for node:crypto to support Jest with CommonJS require() calls
 * This re-exports crypto module as node:crypto
 */
module.exports = require('crypto');
