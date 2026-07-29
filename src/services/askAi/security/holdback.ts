import { echoesNonce, SUGGESTION_FALLBACK_MESSAGE } from './nonceEcho';
import type { AiStream, AiStreamPart } from '@hawk.so/types';

/**
 * Guard decision either to send data downstream or reject.
 */
export type GuardVerdict =
  | {
    rejected: false;

    /**
     * Text safe to forward now.
     */
    emit: string;
  }
  | { rejected: true };

/**
 * AI response stream scanner.
 */
export interface StreamGuard {
  /**
   * Inspect the next piece of model output.
   *
   * @param chunk - text delta produced by the model
   * @returns {GuardVerdict} text safe to forward now
   */
  push(chunk: string): GuardVerdict;

  /**
   * Release whatever is still withheld, once the answer is complete.
   *
   * @returns {GuardVerdict} remaining text safe to forward
   */
  flush(): GuardVerdict;
}

/**
 * AI stream response guard.
 *
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
 * On rejection nothing more is released, and {@link SUGGESTION_FALLBACK_MESSAGE}
 * is returned once.
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
   * Mark the stream as rejected.
   *
   * @returns {GuardVerdict} verdict replacing the rest of the answer
   */
  const reject = (): GuardVerdict => {
    rejected = true;
    withheld = '';
    sentTail = '';

    return { rejected: true };
  };

  return {
    push(chunk: string): GuardVerdict {
      if (rejected) {
        return { rejected: true };
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
        return { rejected: true };
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

/**
 * Wrap a suggestion stream with a guard.
 *
 * @param stream - answer as the model writes it
 * @param guard - guard for this stream, not reusable
 * @param onReject - called once, when the guard first rejects the answer
 * @returns {AiStream} the answer, minus whatever the guard withholds
 */
export async function * guardSuggestionStream(
  stream: AiStream,
  guard: StreamGuard,
  onReject: () => void
): AiStream {
  let rejected = false;

  /**
   * Send what the verdict allows, reporting a rejection on the error channel
   * so the client can tell it from the answer
   *
   * @param verdict - what the guard allows to be sent
   * @yields {AiStreamPart} part to forward, if the verdict carries one
   */
  function * send(verdict: GuardVerdict): Generator<AiStreamPart> {
    if (verdict.rejected) {
      rejected = true;
      onReject();

      yield {
        type: 'error',
        errorText: SUGGESTION_FALLBACK_MESSAGE,
      };

      return;
    }

    if (verdict.emit) {
      yield {
        type: 'text-delta',
        delta: verdict.emit,
      };
    }
  }

  for await (const part of stream) {
    switch (part.type) {
      case 'text-delta':
        yield * send(guard.push(part.delta));
        break;

      case 'error':
        yield part;

        return;

      default: {
        /** Report unhandled part */
        const unscannable: never = part;
        const { type } = unscannable as { type: string };

        throw new Error(`Unscannable suggestion part: ${type}`);
      }
    }

    if (rejected) {
      return;
    }
  }

  yield * send(guard.flush());
}
