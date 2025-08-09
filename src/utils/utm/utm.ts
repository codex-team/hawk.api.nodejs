import { UserDBScheme } from '@hawk.so/types';

/**
 * Validates UTM parameters
 * @param utm - Data form where user went to sign up. Used for analytics purposes
 * @returns boolean - true if valid, false if invalid
 */
export function validateUtmParams(utm: UserDBScheme['utm']): boolean {
  if (!utm) {
    return true;
  }

  // Check if utm is an object
  if (typeof utm !== 'object' || Array.isArray(utm)) {
    return false;
  }

  const utmKeys = ['source', 'medium', 'campaign', 'content', 'term'];
  const providedKeys = Object.keys(utm);

  // Check if utm object is not empty
  if (providedKeys.length === 0) {
    return true; // Empty object is valid
  }

  // Check if all provided keys are valid UTM keys
  const hasInvalidKeys = providedKeys.some((key) => !utmKeys.includes(key));
  if (hasInvalidKeys) {
    return false;
  }

  // Check if values are strings and not too long
  for (const [key, value] of Object.entries(utm)) {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        return false;
      }

      // Check length
      if (value.length === 0 || value.length > 200) {
        return false;
      }

      // Check for valid characters - only allow alphanumeric, spaces, hyphens, underscores, dots
      if (!/^[a-zA-Z0-9\s\-_.]+$/.test(value)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Sanitizes UTM parameters by removing invalid characters
 * @param utm - Data form where user went to sign up. Used for analytics purposes
 * @returns sanitized UTM parameters or undefined if invalid
 */
export function sanitizeUtmParams(utm: UserDBScheme['utm']): UserDBScheme['utm'] {
  if (!utm) {
    return undefined;
  }

  const utmKeys = ['source', 'medium', 'campaign', 'content', 'term'];
  const sanitized: UserDBScheme['utm'] = {};

  for (const [key, value] of Object.entries(utm)) {
    if (utmKeys.includes(key) && value && typeof value === 'string') {
      // Sanitize value: keep only allowed characters and limit length
      const cleanValue = value
        .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
        .trim()
        .substring(0, 200);

      if (cleanValue.length > 0) {
        (sanitized as any)[key] = cleanValue;
      }
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}
