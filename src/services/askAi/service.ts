import { vercelAIApi } from '../../integrations/vercel-ai/';
import { eventSolvingInput } from './inputs/eventSolving';
import { ctoInstruction } from './instructions/cto';
import { EventsFactoryInterface } from '../types';

/**
 * Service for interacting with AI
 */
export class AskAiService {
  /**
   * Generate suggestion for the event
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

    return vercelAIApi.complete({
      system: ctoInstruction,
      prompt: eventSolvingInput(event.payload),
    });
  }
}

export const askAiService = new AskAiService();