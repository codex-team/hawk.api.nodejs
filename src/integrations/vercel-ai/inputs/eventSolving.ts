import { EventData, EventAddons } from '@hawk.so/types';

export const eventSolvingInput = (payload: EventData<EventAddons>) => `

Проанализируй ошибку и предложи решение

Payload: ${JSON.stringify(payload)}

Response:

{
  "solution": "...",
  "explanation": "..."
}
`;
