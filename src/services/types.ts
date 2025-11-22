import { EventAddons, EventData } from '@hawk.so/types';

/**
 * Event type which is returned by events factory
 */
type Event = {
    _id: string;
    payload: EventData<EventAddons>;
};

/**
 * Interface for interacting with events factory
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