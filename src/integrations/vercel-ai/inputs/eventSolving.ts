import { EventData, EventAddons } from '@hawk.so/types';

export const eventSolvingInput = (payload: EventData<EventAddons>) => `
Payload: ${JSON.stringify(payload)}

Предоставь ответ в следующем формате:

1. Описание проблемы
2. Решение проблемы
3. Описание того, как можно предотвратить подобную ошибку в будущем
`;
