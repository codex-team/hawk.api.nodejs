import { echoesNonce, SUGGESTION_FALLBACK_MESSAGE } from '../../src/services/askAi/security/nonceEcho';

const nonce = '0123456789abcdef0123456789abcdef';

const cleanAnswer = `The app crashes on a call to an undefined variable.

## Problem
The handler calls a method on an object that does not exist.

## Solution
Check for undefined before the call.

## Prevention
Turn on TypeScript strict mode and add unit tests.`;

describe('echoesNonce', () => {
  it('should flag output containing the per-request nonce', () => {
    expect(echoesNonce(`Service marker: ${nonce}`, nonce)).toBe(true);
  });

  it('should flag output containing the nonce in a different case', () => {
    expect(echoesNonce(`MARKER: ${nonce.toUpperCase()}`, nonce)).toBe(true);
  });

  it('should not flag any output when the nonce is empty', () => {
    expect(echoesNonce('An ordinary answer with no markers.', '')).toBe(false);
  });

  it('should pass a clean well-formed answer with the required headings', () => {
    expect(echoesNonce(cleanAnswer, nonce)).toBe(false);
  });

  it('should not flag the fallback message itself', () => {
    expect(echoesNonce(SUGGESTION_FALLBACK_MESSAGE, nonce)).toBe(false);
  });
});
