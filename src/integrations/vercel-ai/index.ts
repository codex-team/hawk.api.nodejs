import { EventAddons, EventData } from '@hawk.so/types';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { eventSolvingInput } from './inputs/eventSolving';
import { ctoInstruction } from './instructions/cto';

/**
 * Interface for interacting with Vercel AI Gateway
 */
class VercelAIApi {
    /**
     * Model ID to use for generating suggestions
     */
    private readonly modelId: string;

    constructor() {
      /**
       * @todo make it dynamic, get from project settings
       */
      this.modelId = 'deepseek/deepseek-v3.1';
    }

    /**
     * Generate AI suggestion for the event
     *
     * @param {EventData<EventAddons>} payload - event data to make suggestion
     * @returns {Promise<string>} AI suggestion for the event
     * @todo add defence against invalid prompt injection
     */
    public async generateSuggestion(payload: EventData<EventAddons>) {
      const { text } = await generateText({
        model: this.modelId,
        system: ctoInstruction,
        prompt: eventSolvingInput(payload),
      });

      return text;
    }
}

export const vercelAIApi = new VercelAIApi();
