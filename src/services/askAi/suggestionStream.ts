/**
 * One piece of the answer, in the shape the client reads it.
 *
 * The names are the AI SDK's, which is what the client was written against.
 */
export type SuggestionPart = {
  type: 'text-delta';
  delta: string;
} | {
  type: 'error';
  errorText: string;
};

/**
 * An answer as the model writes it. Implemented by the provider adapter, so
 * the SDK behind it stays behind it.
 */
export type SuggestionStream = AsyncIterable<SuggestionPart>;
