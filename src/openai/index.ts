import { EventAddons, EventData } from "@hawk.so/types";
import OpenAI from "openai";
import { eventSolvingInput } from "./inputs/eventSolving";
import { ctoInstruction } from "./instructions/cto";

class OpenAIApi {
    private readonly client: OpenAI;

    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            // fetch,
        });
    }

    async solveEvent(payload: EventData<EventAddons>) {
        const response = await this.client.responses.create({
            model: "gpt-4o",
            instructions: ctoInstruction,
            input: eventSolvingInput(payload),
        });

        return response.output;
    }
}

export const openAIApi = new OpenAIApi();