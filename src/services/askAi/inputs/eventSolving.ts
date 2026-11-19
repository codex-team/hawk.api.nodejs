import { EventData, EventAddons } from '@hawk.so/types';
import { Event } from '../../types';

/**
 * Serialize event data for the model prompt.
 *
 * @warning returns unwrapped attacker-controlled data (headers, user-agent,
 * query params, stack trace). Sending it to a model bypasses the injection
 * defense. Go through {@link buildEventPrompt}, which wraps it in the
 * nonce-carrying markers spotlighting and {@link echoesNonce} rely on.
 *
 * @param event - event repetition data to make suggestion for
 * @returns serialized, unwrapped event data
 */
export const eventSolvingInput = (event: Event): string => {
  const payload: EventData<EventAddons> = {
    ...(event.payload ?? ({} as EventData<EventAddons>)),
  };

  /**
   * Strip user info to avoid sending personal data to third-party services
   */
  delete payload.user;

  const eventData = {
    catcherType: event.catcherType,
    firstOccurrenceTimestamp: event.originalTimestamp,
    currentRepetitionTimestamp: event.timestamp,
    totalCount: event.totalCount,
    usersAffected: event.usersAffected,
    payload,
  };

  return `
Event: ${JSON.stringify(eventData)}
`;
};
