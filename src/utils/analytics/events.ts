import { Event } from '@amplitude/node';

/**
 * Define available metrics
 */
export enum AnalyticsEventTypes {
  NEW_USER_REGISTERED = 'new user registered',

  WORKSPACE_CREATED = 'workspace created',

  PROJECT_CREATED = 'project created',
}

/**
 * Define analytics event type
 */
export type AnalyticsEvent = Omit<Event, 'event_type'> & { 'event_type': AnalyticsEventTypes };
