import { EventAddons, EventData } from '@hawk.so/types';

type Event = {
    _id: string;
    payload: EventData<EventAddons>;
};

/**
 * Interface for events factory
 */
export interface EventsFactoryInterface {
  /**
   * Get event repetition
   *
   * @param repetitionId - repetition id
   * @param originalEventId - original event id
   * @returns {Promise<EventData<EventAddons>>} - event repetition
   */
  getEventRepetition(repetitionId: string, originalEventId: string): Promise<Event>;
}