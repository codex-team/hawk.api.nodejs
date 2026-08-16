import { echoesNonce, SUGGESTION_FALLBACK_MESSAGE } from './nonceEcho';

/**
 * What the guard allows the transport to send downstream
 */
export interface GuardVerdict {
  /**
   * Text safe to forward now, which is what was fed in minus the holdback
   */
  emit: string;

  /**
   * Whether the nonce was found. Once true it stays true and no further model
   * text is forwarded.
   */
  rejected: boolean;
}

/**
 * Port implemented by the domain and consumed by the transport, so the
 * provider adapter never needs to know what makes output unsafe
 */
export interface StreamGuard {
  /**
   * Inspect the next piece of model output
   *
   * @param chunk - text delta produced by the model
   * @returns {GuardVerdict} text safe to forward now
   */
  push(chunk: string): GuardVerdict;

  /**
   * Release whatever is still withheld, at the end of a text block
   *
   * @returns {GuardVerdict} remaining text safe to forward
   */
  flush(): GuardVerdict;
}

/**
 * Streaming counterpart of {@link echoesNonce}.
 *
 * The nonce can arrive split across two deltas, so scanning each delta alone
 * would never see it whole. The guard keeps a *holdback*: the last
 * `nonce.length - 1` characters fed in so far, kept unsent. Every new delta is
 * scanned together with the holdback, and only the part that can no longer
 * begin the nonce is released.
 *
 * That length is the exact minimum. An occurrence spans `nonce.length`
 * characters, so holding one less leaves it inside a single scanned window.
 *
 * {@link StreamGuard.flush} has to release the holdback at the end of a text
 * block, because that text belongs to the block and cannot be emitted under the
 * next one's id. Its tail is kept as scanning context instead, without which a
 * nonce split across two blocks would pass unseen.
 *
 * On rejection nothing more is released and {@link SUGGESTION_FALLBACK_MESSAGE}
 * is returned once, for the transport to deliver as it sees fit. Text already
 * sent cannot be taken back, and the holdback cuts it at an arbitrary character.
 *
 * @param nonce - per-request nonce used in the prompt markers
 * @returns {StreamGuard} guard for a single stream, not reusable
 */
export function createStreamGuard(nonce: string): StreamGuard {
  const holdback = Math.max(nonce.length - 1, 0);

  let withheld = '';
  let sentTail = '';
  let rejected = false;

  /**
   * Keep only as much already-sent text as a nonce could still overlap
   *
   * @param text - text sent so far, ending with what was just emitted
   * @returns {string} trailing scanning context
   */
  const keepTail = (text: string): string => text.slice(Math.max(text.length - holdback, 0));

  /**
   * Mark the stream as rejected and produce the one verdict that still carries
   * text: the fallback message
   *
   * @returns {GuardVerdict} verdict replacing the rest of the answer
   */
  const reject = (): GuardVerdict => {
    rejected = true;
    withheld = '';
    sentTail = '';

    return {
      emit: SUGGESTION_FALLBACK_MESSAGE,
      rejected: true,
    };
  };

  return {
    push(chunk: string): GuardVerdict {
      if (rejected) {
        return {
          emit: '',
          rejected: true,
        };
      }

      if (echoesNonce(sentTail + withheld + chunk, nonce)) {
        return reject();
      }

      const pending = withheld + chunk;
      const sendable = Math.max(pending.length - holdback, 0);
      const emit = pending.slice(0, sendable);

      withheld = pending.slice(sendable);
      sentTail = keepTail(sentTail + emit);

      return {
        emit,
        rejected: false,
      };
    },

    flush(): GuardVerdict {
      if (rejected) {
        return {
          emit: '',
          rejected: true,
        };
      }

      const pending = withheld;

      withheld = '';

      if (echoesNonce(sentTail + pending, nonce)) {
        return reject();
      }

      sentTail = keepTail(sentTail + pending);

      return {
        emit: pending,
        rejected: false,
      };
    },
  };
}
