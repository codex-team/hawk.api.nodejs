import { EventData, EventAddons } from '@hawk.so/types';

/**
 * Serialize event data for the model prompt.
 *
 * @warning returns unwrapped attacker-controlled data (headers, user-agent,
 * query params, stack trace). Sending it to a model bypasses the injection
 * defense. Go through {@link buildEventPrompt}, which wraps it in the
 * nonce-carrying markers spotlighting and {@link echoesNonce} rely on.
 *
 * @param payload - event data to make suggestion for
 * @returns serialized, unwrapped event data
 */
export const eventSolvingInput = (payload: EventData<EventAddons>) => `
Payload: ${JSON.stringify(payload)}
`;
