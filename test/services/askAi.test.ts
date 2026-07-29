import '../../src/env-test';
import { EventAddons, EventData } from '@hawk.so/types';
import { AskAiService } from '../../src/services/askAi/service';
import { vercelAIApi } from '../../src/integrations/vercel-ai/';
import { ctoInstruction } from '../../src/services/askAi/instructions/cto';
import { eventSolvingInput } from '../../src/services/askAi/inputs/eventSolving';

jest.mock('../../src/integrations/vercel-ai/', () => ({
  vercelAIApi: {
    complete: jest.fn(),
  },
}));

describe('AskAiService', () => {
  let askAiService: AskAiService;
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

  beforeEach(() => {
    jest.clearAllMocks();
    askAiService = new AskAiService();
  });

  describe('generateSuggestion', () => {
    it('should send the instruction and serialized event to the transport and return its text unchanged', async () => {
      (vercelAIApi.complete as jest.Mock).mockResolvedValue('generated suggestion');
      const eventsFactory = eventsFactoryWithPayload();

      const result = await askAiService.generateSuggestion(eventsFactory, testEventId, testOriginalEventId);

      expect(eventsFactory.getEventRepetition).toHaveBeenCalledWith(testEventId, testOriginalEventId);
      expect(vercelAIApi.complete).toHaveBeenCalledWith({
        system: ctoInstruction,
        prompt: eventSolvingInput(testPayload),
      });
      expect(result).toBe('generated suggestion');
    });

    it('should throw Event not found when the events factory returns nothing', async () => {
      await expect(
        askAiService.generateSuggestion(createEventsFactory(null), testEventId, testOriginalEventId)
      ).rejects.toThrow('Event not found');

      expect(vercelAIApi.complete).not.toHaveBeenCalled();
    });
  });
});
