import '../../../../src/env-test';
import { createStreamGuard, guardSuggestionStream } from '../../../../src/services/askAi/security/holdback';
import type { AiStreamPart } from '@hawk.so/types';
import { SUGGESTION_FALLBACK_MESSAGE } from '../../../../src/services/askAi/security/nonceEcho';

const nonce = '0123456789abcdef0123456789abcdef';

/**
 * Feed a whole answer through a guard one chunk at a time
 *
 * @param chunks - text deltas as the model would produce them
 * @returns {object} text the client would have received, and whether the guard rejected
 */
function drain(chunks: string[]): { emitted: string; rejected: boolean } {
  const guard = createStreamGuard(nonce);
  let emitted = '';
  let rejected = false;

  for (const chunk of chunks) {
    const verdict = guard.push(chunk);

    emitted += verdict.rejected ? '' : verdict.emit;
    rejected = rejected || verdict.rejected;
  }

  const final = guard.flush();

  return {
    emitted: emitted + (final.rejected ? '' : final.emit),
    rejected: rejected || final.rejected,
  };
}

describe('createStreamGuard', () => {
  it('should pass a clean answer through unchanged', () => {
    const chunks = ['## Cause\n', 'The variable is not defined. ', 'Check the initialisation.'];

    expect(drain(chunks)).toEqual({
      emitted: chunks.join(''),
      rejected: false,
    });
  });

  it('should withhold the tail until enough text has arrived to clear it', () => {
    const guard = createStreamGuard(nonce);
    const answer = 'short';

    expect(guard.push(answer)).toEqual({
      emit: '',
      rejected: false,
    });
    expect(guard.flush()).toEqual({
      emit: answer,
      rejected: false,
    });
  });

  it('should detect a nonce split across two chunks without ever emitting it', () => {
    const result = drain([`marker ${nonce.slice(0, 20)}`, `${nonce.slice(20)} tail`]);

    expect(result.rejected).toBe(true);
    expect(result.emitted).not.toContain(nonce);
  });

  it('should stay silent for the rest of the stream after rejecting', () => {
    const guard = createStreamGuard(nonce);

    guard.push(`marker ${nonce}`);

    expect(guard.push('the rest of the answer')).toEqual({ rejected: true });
    expect(guard.flush()).toEqual({ rejected: true });
  });
});

/**
 * One piece of model text, as the adapter hands it over
 *
 * @param delta - text the model produced
 * @returns {AiStreamPart} text part carrying it
 */
function text(delta: string): AiStreamPart {
  return {
    type: 'text-delta',
    delta,
  };
}

/**
 * Read everything a guarded stream lets through
 *
 * @param parts - parts the model side produces
 * @param onReject - called when the guard rejects the answer
 * @returns {Promise<AiStreamPart[]>} parts the client would have received
 */
async function guarded(parts: AiStreamPart[], onReject: () => void = () => undefined): Promise<AiStreamPart[]> {
  const received: AiStreamPart[] = [];

  const stream = guardSuggestionStream(
    (async function * () {
      yield * parts;
    })(),
    createStreamGuard(nonce),
    onReject
  );

  for await (const part of stream) {
    received.push(part);
  }

  return received;
}

describe('guardSuggestionStream', () => {
  it('should hold the tail of the answer back until the stream ends', async () => {
    const answer = 'The variable is not defined, check the initialisation of the handler.';
    const held = nonce.length - 1;

    await expect(guarded([ text(answer) ])).resolves.toEqual([
      text(answer.slice(0, answer.length - held)),
      text(answer.slice(answer.length - held)),
    ]);
  });

  it('should deliver a rejection as an error part', async () => {
    await expect(guarded([ text(`marker ${nonce}`), text(' and the rest') ])).resolves.toEqual([ {
      type: 'error',
      errorText: SUGGESTION_FALLBACK_MESSAGE,
    } ]);
  });

  it('should report a rejection once nonce echoes', async () => {
    const onReject = jest.fn();

    await guarded([ text(`marker ${nonce}`), text('more'), text('and more') ], onReject);

    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('should pass a model failure through untouched', async () => {
    const failure: AiStreamPart = {
      type: 'error',
      errorText: 'gateway unavailable',
    };

    await expect(guarded([ text('partial answer'), failure ])).resolves.toEqual([ failure ]);
  });

  it('should refuse a part it cannot scan', async () => {
    const unscannable = {
      type: 'reasoning-delta',
      delta: 'thinking out loud',
    } as unknown as AiStreamPart;

    await expect(guarded([ unscannable ])).rejects.toThrow('Unscannable suggestion part');
  });
});
