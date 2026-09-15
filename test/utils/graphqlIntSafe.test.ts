import '../../src/env-test';

const {
  GRAPHQL_INT_MAX,
  isOutOfGraphQLIntRange,
  unixSecondsFromObjectId,
  utcMidnightUnix,
  toSafeGraphQLInt,
  toSafeUnixTimestampForGraphQLInt,
  toSafeSortValueBoundary,
} = require('../../src/utils/graphqlIntSafe');

describe('graphqlIntSafe', () => {
  const nowSec = Math.floor(new Date('2026-09-15T12:00:00Z').getTime() / 1000);
  const objectId = '6aa93c9b3a3878cb15936a41'; // ~2026-09-15T12:39:55Z
  const objectIdSec = unixSecondsFromObjectId(objectId);

  it('detects values outside GraphQL Int range', () => {
    expect(isOutOfGraphQLIntRange(2736201600)).toBe(true);
    expect(isOutOfGraphQLIntRange(GRAPHQL_INT_MAX)).toBe(false);
    expect(isOutOfGraphQLIntRange(1.5)).toBe(true);
  });

  it('parses unix seconds from ObjectId', () => {
    expect(objectIdSec).toBe(parseInt('6aa93c9b', 16));
  });

  it('clamps oversized counts to Int max', () => {
    expect(toSafeGraphQLInt(3000000000)).toBe(GRAPHQL_INT_MAX);
  });

  it('replaces far-future timestamps with ObjectId time', () => {
    const farFuture = 2736250836;
    const safe = toSafeUnixTimestampForGraphQLInt(farFuture, objectId, nowSec);

    expect(safe).toBe(objectIdSec);
    expect(isOutOfGraphQLIntRange(safe)).toBe(false);
  });

  it('converts millisecond timestamps', () => {
    const ms = (nowSec - 120) * 1000;
    expect(toSafeUnixTimestampForGraphQLInt(ms, objectId, nowSec)).toBe(nowSec - 120);
  });

  it('keeps reasonable timestamps', () => {
    expect(toSafeUnixTimestampForGraphQLInt(nowSec - 3600, objectId, nowSec)).toBe(nowSec - 3600);
  });

  it('builds utc midnight from corrected time', () => {
    const midnight = utcMidnightUnix(objectIdSec);

    expect(midnight).toBeLessThanOrEqual(objectIdSec);
    expect(midnight % 86400).toBe(0);
  });

  it('treats large sort boundaries as timestamps', () => {
    expect(toSafeSortValueBoundary(2736187957, objectId, nowSec)).toBe(objectIdSec);
    expect(toSafeSortValueBoundary(42, objectId, nowSec)).toBe(42);
  });
});
