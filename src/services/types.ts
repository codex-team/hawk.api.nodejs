import { GroupedEventDBScheme } from '@hawk.so/types';

/**
 * Event type which is returned by events factory
 */
export type Event = Pick<GroupedEventDBScheme, 'payload'> &
  Partial<Pick<GroupedEventDBScheme, 'catcherType' | 'timestamp' | 'totalCount' | 'usersAffected'>> & {
    _id: string;
    /**
     * Synthesized in EventsFactory._composeEventWithRepetition from the original event's timestamp
     */
    originalTimestamp?: GroupedEventDBScheme['timestamp'];
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
