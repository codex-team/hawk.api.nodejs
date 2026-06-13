import type { Utm } from '@hawk.so/types';

/**
 * Valid UTM parameter keys
 */
const VALID_UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const;

/**
 * Checks that passed key is supported UTM field.
 *
 * @param key - UTM object key
 * @returns whether key is a valid UTM field
 */
function isValidUtmKey(key: string): key is keyof Utm {
  return (VALID_UTM_KEYS as readonly string[]).includes(key);
}

/**
 * Regular expression for valid UTM characters
 * Allows: alphanumeric, spaces, hyphens, underscores, dots
 */
const VALID_UTM_CHARACTERS = /^[a-zA-Z0-9\s\-_.]+$/;

/**
 * Maximum allowed length for UTM parameter values
 */
const MAX_UTM_VALUE_LENGTH = 50;

/**
 * Validates and filters UTM parameters
 * @param {Object} utm - UTM parameters to validate
 * @returns {Object} - filtered valid UTM parameters
 */
export function validateUtmParams(utm: unknown): Utm | undefined {
  if (!utm || typeof utm !== 'object' || Array.isArray(utm)) {
    return undefined;
  }

  const result: Utm = {};

  for (const [key, value] of Object.entries(utm)) {
    // 1) Remove keys that are not VALID_UTM_KEYS
    if (!isValidUtmKey(key)) {
      continue;
    }

    // 2) Check each condition separately
    if (!value || typeof value !== 'string') {
      continue;
    }

    if (value.length === 0 || value.length > MAX_UTM_VALUE_LENGTH) {
      continue;
    }

    if (!VALID_UTM_CHARACTERS.test(value)) {
      continue;
    }

    result[key] = value;
  }

  return result;
}
