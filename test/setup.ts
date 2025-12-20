/**
 * Jest setup file to provide global APIs needed by MongoDB driver
 */

import { performance } from 'perf_hooks';

/**
 * MongoDB 6.x requires global performance API
 * Node.js provides it via perf_hooks module
 */
global.performance = performance as any;

