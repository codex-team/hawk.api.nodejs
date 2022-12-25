import * as Amplitude from '@amplitude/node';
import { AnalyticsEvent } from './events';

/**
 * Get the token from env vars
 */
const AMPLITUDE_TOKEN = process.env.AMPLITUDE_TOKEN || '';

/**
 * Initialize Amplitude
 */
const amplitude = Amplitude.init(AMPLITUDE_TOKEN);

/**
 * Export available analytics methods
 */
export const Analytics = {
  /**
   * Send an event to analytics server
   *
   * @param event - event to be logged
   * @returns Promise<Amplitude.Response>
   */
  logEvent: (event: AnalyticsEvent): Promise<Amplitude.Response> => {
    return amplitude.logEvent(event);
  },
};
