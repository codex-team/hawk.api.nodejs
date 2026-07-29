import { GraphQLRequestContext } from 'apollo-server-plugin-base';
import { ResolverContextBase } from '../types/graphql';
import { truncateText } from './slowOperationAlert';

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
function sanitizeVariables(variables: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!variables) {
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
 * Build request context for slow GraphQL operation alerts.
 *
 * @param ctx - GraphQL request context
 * @returns alert context
 */
export function buildGraphqlRequestContext(ctx: GraphQLRequestContext): Record<string, unknown> {
  const context = ctx.context as ResolverContextBase | undefined;
  const variables = sanitizeVariables(ctx.request.variables as Record<string, unknown> | undefined);
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
