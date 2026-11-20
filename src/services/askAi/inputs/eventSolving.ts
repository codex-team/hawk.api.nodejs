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
  /**
   * Strip user info to avoid sending personal data to third-party services
   */
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const { user: _user, ...payload } = event.payload;

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
