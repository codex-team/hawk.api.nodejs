import '../../src/env-test';
import { createStreamGuard } from '../../src/services/askAi/security/holdback';
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
