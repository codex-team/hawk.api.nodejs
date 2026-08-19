import '../../src/env-test';
import { createStreamGuard, guardSuggestionStream } from '../../src/services/askAi/security/holdback';
import type { SuggestionPart } from '../../src/services/askAi/suggestionStream';
import { SUGGESTION_FALLBACK_MESSAGE } from '../../src/services/askAi/security/nonceEcho';

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

    emitted += verdict.emit;
    rejected = rejected || verdict.rejected;
  }

  const final = guard.flush();

  return {
    emitted: emitted + final.emit,
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

    expect(guard.push(answer).emit).toBe('');
    expect(guard.flush().emit).toBe(answer);
  });

  it('should detect a nonce split across two chunks without ever emitting it', () => {
    const result = drain([`marker ${nonce.slice(0, 20)}`, `${nonce.slice(20)} tail`]);

    expect(result.rejected).toBe(true);
    expect(result.emitted).not.toContain(nonce);
  });

  it('should detect a nonce split across two text blocks', () => {
    const guard = createStreamGuard(nonce);
    let emitted = '';

    emitted += guard.push(`marker ${nonce.slice(0, 20)}`).emit;
    emitted += guard.flush().emit;

    const verdict = guard.push(`${nonce.slice(20)} tail`);

    emitted += verdict.emit;

    expect(verdict.rejected).toBe(true);
    expect(emitted).not.toContain(nonce);
  });

  it('should detect the nonce echoed in a different case', () => {
    expect(drain([ `marker ${nonce.toUpperCase()} tail` ]).rejected).toBe(true);
  });

  it('should stay silent for the rest of the stream after rejecting', () => {
    const guard = createStreamGuard(nonce);

    guard.push(`marker ${nonce}`);

    expect(guard.push('the rest of the answer')).toEqual({
      emit: '',
      rejected: true,
    });
    expect(guard.flush()).toEqual({
      emit: '',
      rejected: true,
    });
  });

  it('should replace the rest of the answer with the fallback message exactly once', () => {
    const guard = createStreamGuard(nonce);
    const emissions = [
      guard.push(`marker ${nonce}`).emit,
      guard.push('more text').emit,
      guard.flush().emit,
    ].filter(Boolean);

    expect(emissions).toEqual([ SUGGESTION_FALLBACK_MESSAGE ]);
  });
});

/**
 * One piece of model text, as the adapter hands it over
 *
 * @param delta - text the model produced
 * @returns {SuggestionPart} text part carrying it
 */
function text(delta: string): SuggestionPart {
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
 * @returns {Promise<SuggestionPart[]>} parts the client would have received
 */
async function guarded(parts: SuggestionPart[], onReject: () => void = () => undefined): Promise<SuggestionPart[]> {
  const received: SuggestionPart[] = [];

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

  it('should deliver a rejection as an error part instead of more text', async () => {
    await expect(guarded([ text(`marker ${nonce}`), text(' and the rest') ])).resolves.toEqual([ {
      type: 'error',
      errorText: SUGGESTION_FALLBACK_MESSAGE,
    } ]);
  });

  it('should report a rejection once however much text follows it', async () => {
    const onReject = jest.fn();

    await guarded([ text(`marker ${nonce}`), text('more'), text('and more') ], onReject);

    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('should pass a model failure through untouched', async () => {
    const failure: SuggestionPart = {
      type: 'error',
      errorText: 'gateway unavailable',
    };

    await expect(guarded([ text('partial answer'), failure ])).resolves.toEqual([ failure ]);
  });

  it('should refuse a part it cannot scan rather than forward it', async () => {
    const unscannable = {
      type: 'reasoning-delta',
      delta: 'thinking out loud',
    } as unknown as SuggestionPart;

    await expect(guarded([ unscannable ])).rejects.toThrow('Unscannable suggestion part');
  });
});
