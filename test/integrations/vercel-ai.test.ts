import '../../src/env-test';
import { generateText, streamText } from 'ai';
import { vercelAIApi } from '../../src/integrations/vercel-ai/';
import type { GuardVerdict, StreamGuard } from '../../src/services/askAi/security/holdback';

jest.mock('ai', () => ({
  generateText: jest.fn(),
  streamText: jest.fn(),
}));

const testTextId = 'text-block-1';

/**
 * Build a text-delta chunk as the SDK would produce it
 *
 * @param text - delta text
 * @returns text-delta stream part
 */
function delta(text: string): Record<string, unknown> {
  return {
    type: 'text-delta',
    id: testTextId,
    text,
  };
}

/**
 * Pull the transform factory the transport handed to streamText
 *
 * @param mock - mocked streamText
 * @returns the experimental_transform argument of the last call
 */
function transformOf(mock: jest.Mock): unknown {
  return mock.mock.calls[mock.mock.calls.length - 1][0].experimental_transform;
}

/**
 * Drive the transport's real transform: ask it for a stream by calling
 * `stream` with a guard, then push chunks through what it registered.
 *
 * @param guard - guard to install
 * @param chunks - stream parts to feed
 * @param onReject - rejection callback to install
 * @returns every stream part the transform let out
 */
async function runTransformRaw(
  guard: StreamGuard,
  chunks: Record<string, unknown>[],
  onReject: () => void = (): void => undefined
): Promise<{ parts: Record<string, unknown>[] }> {
  (streamText as jest.Mock).mockReturnValue({});

  vercelAIApi.stream({
    system: 'system',
    prompt: 'prompt',
    guard,
    onReject,
  });

  const factory = transformOf(streamText as jest.Mock) as () => TransformStream;
  const transform = factory();
  const writer = transform.writable.getWriter();
  const reader = transform.readable.getReader();
  const parts: Record<string, unknown>[] = [];

  const collecting = (async (): Promise<void> => {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        return;
      }

      parts.push(value as Record<string, unknown>);
    }
  })();

  for (const chunk of chunks) {
    await writer.write(chunk);
  }

  await writer.close();
  await collecting;

  return { parts };
}

/**
 * Same as `runTransformRaw`, reduced to the text that reached the client
 *
 * @param guard - guard to install
 * @param chunks - stream parts to feed
 * @param onReject - rejection callback to install
 * @returns text of every text-delta the transform let out
 */
async function runTransform(
  guard: StreamGuard,
  chunks: Record<string, unknown>[],
  onReject: () => void = (): void => undefined
): Promise<string[]> {
  const { parts } = await runTransformRaw(guard, chunks, onReject);

  return parts
    .filter((part) => part.type === 'text-delta')
    .map((part) => part.text as string);
}

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
        guard: {
          push: (chunk: string): GuardVerdict => ({
            emit: chunk,
            rejected: false,
          }),
          flush: (): GuardVerdict => ({
            emit: '',
            rejected: false,
          }),
        },
        onReject: (): void => undefined,
      });

      expect(streamText).toHaveBeenCalledWith(expect.objectContaining({
        model: testModelId,
        system: testSystem,
        prompt: testPrompt,
        providerOptions: testProviderOptions,
      }));
      expect(result).toBe(streamResult);
    });
  });

  describe('stream guard wiring', () => {
    /**
     * Stand-in for the real stream guard: records what it was fed and dictates
     * what may leave, so the transport's plumbing is tested without the
     * detection logic (covered by askAi-holdback.test.ts)
     *
     * @param verdicts - verdicts to return, in order; anything past the end
     * passes the text through unchanged
     * @returns {StreamGuard} guard stub that also exposes what it was fed
     */
    const stubGuard = (verdicts: GuardVerdict[]): StreamGuard & { fed: string[] } => {
      const fed: string[] = [];
      let call = 0;

      return {
        fed,
        push: (chunk: string): GuardVerdict => {
          fed.push(chunk);

          return verdicts[call++] ?? {
            emit: chunk,
            rejected: false,
          };
        },
        flush: (): GuardVerdict => verdicts[call++] ?? {
          emit: '',
          rejected: false,
        },
      };
    };

    it('should route text deltas through the guard and forward only what it allows', async () => {
      const guard = stubGuard([
        {
          emit: 'allowed',
          rejected: false,
        },
        {
          emit: '',
          rejected: false,
        },
      ]);

      const emitted = await runTransform(guard, [delta('first'), delta('second')]);

      expect(guard.fed).toEqual(['first', 'second']);
      expect(emitted).toEqual([ 'allowed' ]);
    });

    it('should release the withheld tail when the model closes the text block', async () => {
      const guard = stubGuard([
        {
          emit: '',
          rejected: false,
        },
        {
          emit: 'tail',
          rejected: false,
        },
      ]);

      const emitted = await runTransform(guard, [delta('held back'), {
        type: 'text-end',
        id: testTextId,
      } ]);

      expect(emitted).toEqual([ 'tail' ]);
    });

    it('should deliver a rejection as an error part instead of more text', async () => {
      const guard = stubGuard([
        {
          emit: 'Could not generate an answer.',
          rejected: true,
        },
        {
          emit: '',
          rejected: true,
        },
      ]);

      const { parts } = await runTransformRaw(guard, [delta('first'), delta('second')]);

      expect(parts.filter((part) => part.type === 'text-delta')).toEqual([]);
      expect(parts.filter((part) => part.type === 'error')).toEqual([ {
        type: 'error',
        error: new Error('Could not generate an answer.'),
      } ]);
    });

    it('should report a rejection once even when the guard keeps reporting it', async () => {
      const onReject = jest.fn();
      const guard = stubGuard([
        {
          emit: '',
          rejected: true,
        },
        {
          emit: '',
          rejected: true,
        },
      ]);

      await runTransform(guard, [delta('first'), delta('second')], onReject);

      expect(onReject).toHaveBeenCalledTimes(1);
    });

    it('should pass non-text chunks through untouched', async () => {
      const guard = stubGuard([]);
      const chunks = [ {
        type: 'text-start',
        id: testTextId,
      } ];

      const { parts } = await runTransformRaw(guard, chunks);

      expect(parts).toContainEqual(chunks[0]);
    });
  });
});
