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
    it('should forward the system/prompt pair to streamText and return its result synchronously', () => {
      const streamResult = { toUIMessageStreamResponse: jest.fn() };

      (streamText as jest.Mock).mockReturnValue(streamResult);

      const result = vercelAIApi.stream({
        system: testSystem,
        prompt: testPrompt,
      });

      expect(streamText).toHaveBeenCalledWith({
        model: testModelId,
        system: testSystem,
        prompt: testPrompt,
        providerOptions: testProviderOptions,
      });
      expect(result).toBe(streamResult);
    });
  });
});
