import { EventAddons, EventData } from '@hawk.so/types';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { eventSolvingInput } from './inputs/eventSolving';
import { ctoInstruction } from './instructions/cto';

/**
 * Vercel AI API
 */
class VercelAIApi {
    /**
     * Model ID
     */
    private readonly modelId: string;

    constructor() {
      /**
       * @todo make it dynamic, get from project settings
       */
      this.modelId = 'gpt-4o';
    }

    /**
     * Generate AI suggestion for the event
     *
     * @param {EventData<EventAddons>} payload - event data
     * @returns {Promise<string>} AI suggestion for the event
     */
    public async generateSuggestion(payload: EventData<EventAddons>) {
      const { text } = await generateText({
        model: openai(this.modelId),
        system: ctoInstruction,
        prompt: eventSolvingInput(payload),
      });

      return text;
    }
}

export const vercelAIApi = new VercelAIApi();
