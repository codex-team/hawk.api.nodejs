declare module 'ai' {
    /**
     * Minimal type for generateText used in server-side integration.
     */
    export function generateText(input: {
        model: any;
        system?: string;
        prompt: string;
    }): Promise<{ text: string }>;
}

declare module '@ai-sdk/openai' {
    /**
     * Minimal types for OpenAI provider.
     */
    export function createOpenAI(config?: { apiKey?: string }): (model: string) => any;
    export const openai: (model: string) => any;
}
