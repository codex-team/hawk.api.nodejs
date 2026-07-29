import '../../src/env-test';
import { generateText, streamText } from 'ai';
import { vercelAIApi } from '../../src/integrations/vercel-ai/';

jest.mock('ai', () => ({
  generateText: jest.fn(),
  streamText: jest.fn(),
}));

describe('VercelAIApi', () => {
  const testSystem = 'system instruction';
  const testPrompt = 'user prompt';
  const testModelId = 'deepseek/deepseek-v4-flash';
  const testProviderOptions = {
    gateway: {
      order: ['novita', 'azure', 'deepseek'],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('complete', () => {
    it('should forward the system/prompt pair to generateText and return its text', async () => {
      (generateText as jest.Mock).mockResolvedValue({ text: 'model output' });

      const result = await vercelAIApi.complete({
        system: testSystem,
        prompt: testPrompt,
      });

      expect(generateText).toHaveBeenCalledWith({
        model: testModelId,
        system: testSystem,
        prompt: testPrompt,
        providerOptions: testProviderOptions,
      });
      expect(result).toBe('model output');
    });
  });

  describe('stream', () => {
    const testSignal = new AbortController().signal;

    /**
     * Answer streamText with a canned stream of parts in the SDK's own shape
     *
     * @param parts - parts the model is to produce
     */
    function modelProduces(parts: unknown[]): void {
      (streamText as jest.Mock).mockReturnValue({
        fullStream: (async function * () {
          yield* parts;
        })(),
      });
    }

    /**
     * Read everything the adapter yields for the test prompt
     *
     * @returns {Promise<unknown[]>} suggestion parts, in order
     */
    async function readSuggestion(): Promise<unknown[]> {
      const parts = [];

      for await (const part of vercelAIApi.stream({
        system: testSystem,
        prompt: testPrompt,
        signal: testSignal,
      })) {
        parts.push(part);
      }

      return parts;
    }

    it('should forward the system/prompt pair and the abort signal to streamText', async () => {
      modelProduces([]);

      await readSuggestion();

      expect(streamText).toHaveBeenCalledWith({
        model: testModelId,
        system: testSystem,
        prompt: testPrompt,
        providerOptions: testProviderOptions,
        abortSignal: testSignal,
      });
    });

    it('should turn the model text deltas into text parts', async () => {
      modelProduces([
        { type: 'start' },
        { type: 'reasoning-delta', id: '0', text: 'thinking out loud', },
        { type: 'text-delta', id: '0', text: 'Answer ', },
        { type: 'text-delta', id: '0', text: 'continues', },
        { type: 'finish' },
      ]);

      await expect(readSuggestion()).resolves.toEqual([
        { type: 'text-delta', delta: 'Answer ', },
        { type: 'text-delta', delta: 'continues', },
      ]);
    });

    it('should turn a model failure into an error part carrying its message', async () => {
      modelProduces([{ type: 'error', error: new Error('gateway unavailable') }]);

      await expect(readSuggestion()).resolves.toEqual([
        { type: 'error', errorText: 'gateway unavailable', },
      ]);
    });
  });
});
