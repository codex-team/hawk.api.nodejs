import { ResolverContextBase } from '../../types/graphql';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const EventsFactory = require('../../models/eventsFactory');

/**
 * Returns a per-request, per-project EventsFactory instance
 * Uses context.eventsFactoryCache to memoize by projectId
 *
 * @param {ResolverContextBase} context - resolver context
 * @param {string} projectId - project id to get EventsFactory instance for
 * @returns {EventsFactory} - EventsFactory instance bound to a specific project object
 */
export function getEventsFactory(context: ResolverContextBase, projectId: string) {
  if (!context.eventsFactoryCache) {
    context.eventsFactoryCache = new Map();
  }

  const cache = context.eventsFactoryCache;

  if (cache) {
    if (!cache.has(projectId)) {
      cache.set(projectId, new EventsFactory(projectId));
    }

    return cache.get(projectId);
  }

  return new EventsFactory(projectId);
}

export default getEventsFactory;
