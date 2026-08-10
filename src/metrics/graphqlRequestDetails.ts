import { GraphQLRequestContext } from 'apollo-server-plugin-base';
import { GraphQLError } from 'graphql';
import { ResolverContextBase } from '../types/graphql';
import { truncateText } from './slowOperationAlert';

const MAX_ALERT_ERRORS = 10;
const MAX_ALERT_ERRORS_LENGTH = 1200;

const SENSITIVE_VARIABLE_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'authorization',
]);

const HIGHLIGHTED_VARIABLE_KEYS = new Set([
  'projectid',
  'workspaceid',
  'eventid',
  'originaleventid',
  'release',
  'search',
  'assignee',
  'cursor',
]);

/**
 * Redact sensitive GraphQL variables before sending alerts.
 *
 * @param value - variable value
 * @param key - variable key
 * @returns sanitized value
 */
function sanitizeVariableValue(value: unknown, key: string): unknown {
  if (SENSITIVE_VARIABLE_KEYS.has(key.toLowerCase())) {
    return '[redacted]';
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeVariableValue(item, `${key}[${index}]`));
  }

  if (value && typeof value === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return sanitizeVariables(value as Record<string, unknown>);
  }

  return value;
}

/**
 * Redact sensitive GraphQL variables before sending alerts.
 *
 * @param variables - GraphQL request variables
 * @returns sanitized variables
 */
function sanitizeVariables(
  variables: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  /**
   * Null / non-object values are treated as empty — many clients send
   * `variables: null` for operations without variables, and arrays are not a
   * valid GraphQL variables map.
   */
  if (variables == null || typeof variables !== 'object' || Array.isArray(variables)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [key, sanitizeVariableValue(value, key)])
  );
}

/**
 * Extract useful identifiers from nested GraphQL variables.
 *
 * @param value - variable value
 * @param prefix - nested path prefix
 * @param result - accumulator for extracted ids
 * @returns extracted identifiers
 */
function collectHighlightedIds(
  value: unknown,
  prefix = '',
  result: Record<string, string | number | boolean> = {}
): Record<string, string | number | boolean> {
  if (!value || typeof value !== 'object') {
    return result;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (
      HIGHLIGHTED_VARIABLE_KEYS.has(key.toLowerCase()) &&
      (typeof nestedValue === 'string' || typeof nestedValue === 'number' || typeof nestedValue === 'boolean')
    ) {
      result[path] = nestedValue;
      continue;
    }

    if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
      collectHighlightedIds(nestedValue, path, result);
    }
  }

  return result;
}

/**
 * Flatten GraphQL errors into a capped string for Hawk alert context.
 * sanitizeContext() only truncates top-level strings, not values nested in arrays.
 * Reserves space for an omitted-count suffix and truncateText()'s ellipsis.
 *
 * @param errors - GraphQL errors from the request
 * @returns flattened and truncated error messages
 */
export function formatGraphqlErrorsForAlert(errors: readonly GraphQLError[]): string {
  const messages = errors.slice(0, MAX_ALERT_ERRORS).map((error) => error.message);
  const omittedCount = errors.length - messages.length;
  const omittedSuffix = omittedCount > 0 ? `; …(+${omittedCount} more)` : '';
  const maxMessagesLength = Math.max(0, MAX_ALERT_ERRORS_LENGTH - omittedSuffix.length - 1);

  return `${truncateText(messages.join('; '), maxMessagesLength)}${omittedSuffix}`;
}

/**
 * Build request context for slow GraphQL operation alerts.
 *
 * @param ctx - GraphQL request context
 * @returns alert context
 */
export function buildGraphqlRequestContext(ctx: GraphQLRequestContext): Record<string, unknown> {
  const context = ctx.context as ResolverContextBase | undefined;
  const variables = sanitizeVariables(
    ctx.request.variables as Record<string, unknown> | null | undefined
  );
  const highlightedIds = collectHighlightedIds(variables);
  const alertContext: Record<string, unknown> = {};

  if (context?.user?.id) {
    alertContext.userId = context.user.id;
  }

  if (Object.keys(highlightedIds).length > 0) {
    alertContext.ids = highlightedIds;
  }

  const variablesJson = JSON.stringify(variables);

  if (variablesJson && variablesJson !== '{}') {
    alertContext.variables = truncateText(variablesJson, 1200);
  }

  return alertContext;
}
