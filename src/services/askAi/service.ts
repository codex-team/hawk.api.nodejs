import HawkCatcher from '@hawk.so/nodejs';
import { vercelAIApi } from '../../integrations/vercel-ai/';
import { buildEventPrompt, spotlightInstruction } from './security/spotlighting';
import { echoesNonce, SUGGESTION_FALLBACK_MESSAGE } from './security/nonceEcho';
import { ctoInstruction } from './instructions/cto';
import { EventsFactoryInterface } from '../types';
import type { Event } from '../types';
import type { AiStream } from '@hawk.so/types';

/**
 * Report that the nonce check rejected an answer.
 *
 * Only the event ids are reported: the rejected text is attacker-influenced
 * payload, and shipping it to the tracker would turn a defense into a way of
 * copying arbitrary third-party data there.
 *
 * @param eventId - id of the event repetition the suggestion was built for
 * @param originalEventId - id of the original event
 */
function reportRejectedSuggestion(eventId: string, originalEventId: string): void {
  const context = {
    eventId,
    originalEventId,
  };

  console.error('AI suggestion rejected: model output echoed the data-block nonce', context);
  HawkCatcher.send(new Error('AI suggestion rejected: model output echoed the data-block nonce'), context);
}

/**
 * Looks up an event and turns it into an AI suggestion, guarding the model
 * call against the event payload trying to hijack the prompt.
 */
export class AskAiService {
  /**
   * Generate suggestion for the event.
   *
   * The event payload is untrusted input, so the defense against prompt
   * injection sits here rather than in the transport.
   *
   * @param eventsFactory - events factory
   * @param eventId - event id
   * @param originalEventId - original event id
   * @returns {Promise<string>} - suggestion
   */
  public async generateSuggestion(
    eventsFactory: EventsFactoryInterface,
    eventId: string,
    originalEventId: string
  ): Promise<string> {
    const event = await this.getEventOrThrow(eventsFactory, eventId, originalEventId);

    const { prompt, nonce } = buildEventPrompt(event.payload);

    const text = await vercelAIApi.complete({
      system: ctoInstruction + spotlightInstruction(nonce),
      prompt,
    });

    if (echoesNonce(text, nonce)) {
      reportRejectedSuggestion(eventId, originalEventId);

      return SUGGESTION_FALLBACK_MESSAGE;
    }

    return text;
  }

  /**
   * Generate a streaming suggestion for the event, spotlighted exactly as
   * {@link AskAiService.generateSuggestion}
   *
   * @param eventsFactory - events factory
   * @param eventId - event id
   * @param originalEventId - original event id
   * @param signal - aborted when the answer is no longer wanted
   * @returns {Promise<AiStream>} - suggestion, as the model writes it
   */
  public async streamSuggestion(
    eventsFactory: EventsFactoryInterface,
    eventId: string,
    originalEventId: string,
    signal: AbortSignal
  ): Promise<AiStream> {
    const event = await this.getEventOrThrow(eventsFactory, eventId, originalEventId);

    const { prompt, nonce } = buildEventPrompt(event.payload);

    return vercelAIApi.stream({
      system: ctoInstruction + spotlightInstruction(nonce),
      prompt,
      signal,
    });
  }

  /**
   * Find the event repetition. A failed lookup is reported as a missing one,
   * so the reason does not reach the caller.
   *
   * @param eventsFactory - events factory
   * @param eventId - event id
   * @param originalEventId - original event id
   * @returns {Promise<Event>} - event repetition
   */
  private async getEventOrThrow(
    eventsFactory: EventsFactoryInterface,
    eventId: string,
    originalEventId: string
  ): Promise<Event> {
    let event: Event | null;

    try {
      event = await eventsFactory.getEventRepetition(eventId, originalEventId);
    } catch {
      throw new Error('Event not found');
    }

    if (!event) {
      throw new Error('Event not found');
    }

    return event;
  }
}

export const askAiService = new AskAiService();
