import '../../src/env-test';
import HawkCatcher from '@hawk.so/nodejs';
import { EventAddons, EventData } from '@hawk.so/types';
import { AskAiService } from '../../src/services/askAi/service';
import { vercelAIApi } from '../../src/integrations/vercel-ai/';
import { ctoInstruction } from '../../src/services/askAi/instructions/cto';
import { UNTRUSTED_DATA_MARKER_NAME } from '../../src/services/askAi/security/spotlighting';
import { SUGGESTION_FALLBACK_MESSAGE } from '../../src/services/askAi/security/nonceEcho';

jest.mock('../../src/integrations/vercel-ai/', () => ({
  vercelAIApi: {
    complete: jest.fn(),
    stream: jest.fn(),
  },
}));

jest.mock('@hawk.so/nodejs', () => ({
  __esModule: true,
  default: { send: jest.fn() },
}));

/**
 * Extract the per-request nonce from the prompt handed to the transport
 *
 * @param prompt - prompt captured from the transport's `complete`/`stream` call
 * @returns {string} nonce carried by the untrusted-data marker
 */
function nonceFromPrompt(prompt: string): string {
  const match = prompt.match(new RegExp(`<<${UNTRUSTED_DATA_MARKER_NAME} ([0-9a-f]{32})>>`));

  if (!match) {
    throw new Error('Prompt does not contain the untrusted-data marker');
  }

  return match[1];
}

describe('AskAiService', () => {
  let askAiService: AskAiService;
  let consoleErrorSpy: jest.SpyInstance;
  const testEventId = 'repetition-id';
  const testOriginalEventId = 'original-event-id';
  const testPayload: EventData<EventAddons> = {
    title: 'TypeError: cannot read property of undefined',
  };

  /**
   * Build a stub events factory returning the given event
   *
   * @param event - event repetition to resolve, or null when not found
   * @returns {object} stub factory
   */
  const createEventsFactory = (event: { _id: string; payload: EventData<EventAddons> } | null): { getEventRepetition: jest.Mock } => ({
    getEventRepetition: jest.fn().mockResolvedValue(event),
  });

  const eventsFactoryWithPayload = (): ReturnType<typeof createEventsFactory> => createEventsFactory({
    _id: testEventId,
    payload: testPayload,
  });

  /**
   * Make the transport answer with the nonce it was given, as a model
   * reproducing the data markers would
   */
  const respondWithNonce = (): void => {
    (vercelAIApi.complete as jest.Mock).mockImplementation((async ({ prompt }: { prompt: string }) => (
      `Service marker: ${nonceFromPrompt(prompt)}`
    )) as never);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    askAiService = new AskAiService();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('generateSuggestion', () => {
    it('should spotlight the event with a nonce the system instruction repeats, and return the answer unchanged', async () => {
      (vercelAIApi.complete as jest.Mock).mockResolvedValue('generated suggestion');

      const result = await askAiService.generateSuggestion(eventsFactoryWithPayload(), testEventId, testOriginalEventId);
      const args = (vercelAIApi.complete as jest.Mock).mock.calls[0][0] as { system: string; prompt: string };

      expect(args.prompt).toContain(JSON.stringify(testPayload));
      expect(args.system.startsWith(ctoInstruction)).toBe(true);
      expect(args.system).toContain(nonceFromPrompt(args.prompt));
      expect(result).toBe('generated suggestion');
    });

    it('should throw Event not found when the events factory returns nothing', async () => {
      await expect(
        askAiService.generateSuggestion(createEventsFactory(null), testEventId, testOriginalEventId)
      ).rejects.toThrow('Event not found');

      expect(vercelAIApi.complete).not.toHaveBeenCalled();
    });

    it('should normalize a thrown lookup failure to Event not found', async () => {
      const eventsFactory = {
        getEventRepetition: jest.fn().mockRejectedValue(new Error(`Cant find event repetition for repetitionId: ${testEventId}`)),
      };

      await expect(
        askAiService.generateSuggestion(eventsFactory, testEventId, testOriginalEventId)
      ).rejects.toThrow('Event not found');

      expect(vercelAIApi.complete).not.toHaveBeenCalled();
    });

    it('should return the fallback and report the event ids when the answer echoes the nonce', async () => {
      respondWithNonce();

      const result = await askAiService.generateSuggestion(eventsFactoryWithPayload(), testEventId, testOriginalEventId);
      const eventIds = expect.objectContaining({
        eventId: testEventId,
        originalEventId: testOriginalEventId,
      });

      expect(result).toBe(SUGGESTION_FALLBACK_MESSAGE);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(String), eventIds);
      expect(HawkCatcher.send).toHaveBeenCalledWith(expect.any(Error), eventIds);
    });

    it('should not report the rejected model output', async () => {
      respondWithNonce();

      await askAiService.generateSuggestion(eventsFactoryWithPayload(), testEventId, testOriginalEventId);

      /**
       * The rejected text is attacker-influenced payload; reporting it would
       * turn the check into a way of copying third-party data into Hawk
       */
      const [error, context] = (HawkCatcher.send as jest.Mock).mock.calls[0] as [Error, unknown];

      expect(error.message).not.toContain('Service marker');
      expect(JSON.stringify(context)).not.toContain('Service marker');
    });
  });

  describe('streamSuggestion', () => {
    it('should spotlight the event with a nonce the system instruction repeats, and return the stream unchanged', async () => {
      const streamResult = (async function * () {
        yield { type: 'text-delta', delta: 'Answer' };
      })();

      (vercelAIApi.stream as jest.Mock).mockReturnValue(streamResult);

      const signal = new AbortController().signal;

      const result = await askAiService.streamSuggestion(eventsFactoryWithPayload(), testEventId, testOriginalEventId, signal);
      const args = (vercelAIApi.stream as jest.Mock).mock.calls[0][0] as { system: string; prompt: string; signal: AbortSignal };

      expect(args.prompt).toContain(JSON.stringify(testPayload));
      expect(args.system.startsWith(ctoInstruction)).toBe(true);
      expect(args.system).toContain(nonceFromPrompt(args.prompt));
      expect(args.signal).toBe(signal);
      expect(result).toBe(streamResult);
    });

    it('should throw Event not found when the events factory returns nothing', async () => {
      await expect(
        askAiService.streamSuggestion(createEventsFactory(null), testEventId, testOriginalEventId, new AbortController().signal)
      ).rejects.toThrow('Event not found');

      expect(vercelAIApi.stream).not.toHaveBeenCalled();
    });
  });
});
