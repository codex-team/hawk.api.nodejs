import { EventData, EventAddons } from '@hawk.so/types';

export const eventSolvingInput = (payload: EventData<EventAddons>) => `
Payload: ${JSON.stringify(payload)}
`;
