import { ResolverContextBase } from '../../types/graphql';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const EventsFactory = require('../../models/eventsFactory');

/**
 * Returns a request-scoped, per-project EventsFactory instance using context cache
 * Falls back to a fresh instance if cache is not available (shouldn't happen in normal flow)
 */
export function getEventsFactory(context: ResolverContextBase, projectId: string) {
  const cache = context && context.eventsFactoryCache;

  if (cache) {
    if (!cache.has(projectId)) {
      cache.set(projectId, new EventsFactory(projectId));
    }

    return cache.get(projectId);
  }

  return new EventsFactory(projectId);
}

export default getEventsFactory;
