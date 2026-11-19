/**
 * Message returned to the user instead of a rejected suggestion
 */
export const SUGGESTION_FALLBACK_MESSAGE = 'Could not generate an answer.';

/**
 * True if the output reproduces the per-request nonce, which only the markers
 * wrapping the untrusted data contain.
 *
 * Matching the nonce and nothing else is deliberate. A list of system-prompt
 * phrases would instead tie this check to the prompt's wording, and a phrase
 * an attacker guesses can be planted in a header to force false rejections.
 *
 * Stays import-free so the streaming path can reuse it inside a holdback
 * transform.
 *
 * @see {@link https://arxiv.org/abs/2507.05630} on why model-based detectors
 * are unreliable and bypassable
 * @param output - text produced by the model
 * @param nonce - per-request marker nonce, matched case-insensitively so that
 * an "echo it in uppercase" instruction cannot evade it. An empty nonce never
 * matches, otherwise every answer would be rejected
 * @returns {boolean} whether the output must be rejected
 */
export function echoesNonce(output: string, nonce: string): boolean {
  return Boolean(nonce) && output.toLowerCase().includes(nonce.toLowerCase());
}
