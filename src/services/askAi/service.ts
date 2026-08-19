import HawkCatcher from '@hawk.so/nodejs';
import { vercelAIApi } from '../../integrations/vercel-ai/';
import { buildEventPrompt, spotlightInstruction } from './security/spotlighting';
import { echoesNonce, SUGGESTION_FALLBACK_MESSAGE } from './security/nonceEcho';
import { ctoInstruction } from './instructions/cto';
import { EventsFactoryInterface } from '../types';

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
 * Service for interacting with AI
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
  public async generateSuggestion(eventsFactory: EventsFactoryInterface, eventId: string, originalEventId: string): Promise<string> {
    const event = await eventsFactory.getEventRepetition(eventId, originalEventId);

    if (!event) {
      throw new Error('Event not found');
    }

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
}

export const askAiService = new AskAiService();
