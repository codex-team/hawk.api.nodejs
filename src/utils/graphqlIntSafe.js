/**
 * TEMPORARY (remove after ~2026-11-15 together with sanitizeDailyEvent* in
 * project.js): helpers to keep GraphQL Int fields within the signed 32-bit
 * range while legacy/bad Sentry timestamps (e.g. year 2056) may still exist.
 */

const GRAPHQL_INT_MIN = -2147483648;
const GRAPHQL_INT_MAX = 2147483647;

/**
 * Allow a small clock skew ahead of server time.
 */
const FUTURE_SLACK_SEC = 24 * 60 * 60;

/**
 * Reject timestamps older than this relative to now.
 */
const MAX_PAST_SEC = 10 * 365.25 * 24 * 60 * 60;

/**
 * Values above this are almost certainly unix milliseconds, not seconds.
 */
const UNIX_MS_THRESHOLD = 1e12;

/**
 * Counts rarely reach 1e9; unix seconds for modern dates do.
 */
const TIMESTAMP_SORT_VALUE_THRESHOLD = 1e9;

/**
 * @param {*} value
 * @returns {boolean}
 */
function isOutOfGraphQLIntRange(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return false;
  }

  if (!Number.isInteger(value)) {
    return true;
  }

  return value < GRAPHQL_INT_MIN || value > GRAPHQL_INT_MAX;
}

/**
 * @param {string|object|null|undefined} id - Mongo ObjectId or hex string
 * @returns {number|null} unix seconds from ObjectId, or null
 */
function unixSecondsFromObjectId(id) {
  if (!id) {
    return null;
  }

  const hex = id.toString().slice(0, 8);

  if (!/^[a-fA-F0-9]{8}$/.test(hex)) {
    return null;
  }

  const ts = parseInt(hex, 16);

  if (!Number.isFinite(ts)) {
    return null;
  }

  return ts;
}

/**
 * @param {number} unixSeconds
 * @returns {number} UTC midnight unix seconds
 */
function utcMidnightUnix(unixSeconds) {
  const date = new Date(unixSeconds * 1000);

  date.setUTCHours(0, 0, 0, 0);

  return Math.floor(date.getTime() / 1000);
}

/**
 * Clamp any number into GraphQL Int range.
 *
 * @param {*} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
function toSafeGraphQLInt(value, fallback = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return toSafeGraphQLInt(fallback, 0);
  }

  const intValue = Math.trunc(value);

  if (intValue > GRAPHQL_INT_MAX) {
    return GRAPHQL_INT_MAX;
  }

  if (intValue < GRAPHQL_INT_MIN) {
    return GRAPHQL_INT_MIN;
  }

  return intValue;
}

/**
 * Convert a stored unix timestamp into a GraphQL-Int-safe value.
 * Prefers ObjectId receive-time when the stored value is absurd / out of Int32.
 * Non-numbers are returned unchanged.
 *
 * @param {*} value - stored timestamp (seconds or ms)
 * @param {string|object|null|undefined} fallbackId - ObjectId for fallback seconds
 * @param {number} [nowSec=Math.floor(Date.now()/1000)]
 * @returns {*}
 */
function toSafeUnixTimestampForGraphQLInt(value, fallbackId, nowSec = Math.floor(Date.now() / 1000)) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value;
  }

  const fromOid = unixSecondsFromObjectId(fallbackId);
  const fallback = fromOid != null ? fromOid : Math.min(nowSec, GRAPHQL_INT_MAX);

  let ts = Math.trunc(value);

  if (ts > UNIX_MS_THRESHOLD) {
    ts = Math.floor(ts / 1000);
  }

  const maxFuture = nowSec + FUTURE_SLACK_SEC;
  const minPast = nowSec - MAX_PAST_SEC;

  if (
    ts > GRAPHQL_INT_MAX ||
    ts < GRAPHQL_INT_MIN ||
    ts > maxFuture ||
    ts < minPast
  ) {
    return toSafeGraphQLInt(fallback, nowSec);
  }

  return ts;
}

/**
 * @param {*} value
 * @param {number} [nowSec=Math.floor(Date.now()/1000)]
 * @returns {boolean}
 */
function isUnsafeUnixTimestamp(value, nowSec = Math.floor(Date.now() / 1000)) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return false;
  }

  let ts = Math.trunc(value);

  if (ts > UNIX_MS_THRESHOLD) {
    ts = Math.floor(ts / 1000);
  }

  const maxFuture = nowSec + FUTURE_SLACK_SEC;
  const minPast = nowSec - MAX_PAST_SEC;

  return (
    ts > GRAPHQL_INT_MAX ||
    ts < GRAPHQL_INT_MIN ||
    ts > maxFuture ||
    ts < minPast ||
    !Number.isInteger(value)
  );
}

/**
 * sortValueBoundary may be lastRepetitionTime, count, or affectedUsers.
 *
 * @param {*} value
 * @param {string|object|null|undefined} idBoundary
 * @param {number} [nowSec]
 * @returns {number}
 */
function toSafeSortValueBoundary(value, idBoundary, nowSec = Math.floor(Date.now() / 1000)) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value;
  }

  if (Math.abs(value) >= TIMESTAMP_SORT_VALUE_THRESHOLD || value > GRAPHQL_INT_MAX || value < GRAPHQL_INT_MIN) {
    return toSafeUnixTimestampForGraphQLInt(value, idBoundary, nowSec);
  }

  return toSafeGraphQLInt(value, 0);
}

module.exports = {
  GRAPHQL_INT_MIN,
  GRAPHQL_INT_MAX,
  isOutOfGraphQLIntRange,
  isUnsafeUnixTimestamp,
  unixSecondsFromObjectId,
  utcMidnightUnix,
  toSafeGraphQLInt,
  toSafeUnixTimestampForGraphQLInt,
  toSafeSortValueBoundary,
};
