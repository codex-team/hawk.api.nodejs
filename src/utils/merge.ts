import mergeWith from 'lodash.mergewith';
import cloneDeep from 'lodash.clonedeep';
import { patch } from '@n1ru4l/json-patch-plus';

type HawkEvent = {
  payload: {
    [key: string]: any
  }
}

type HawkEventRepetition = {
  payload: {
    [key: string]: any
  }
  delta: string;
}

/**
 * One of the features of the events is that their repetition is the difference
 * between the original, which greatly optimizes storage. So we need to restore
 * the original repetition payload using the very first event and its difference
 * between its repetition
 *
 * @param originalEvent - the very first event we received
 * @param repetition - the difference with its repetition, for the repetition we want to display
 * @returns fully assembled payload of the current repetition
 */
export function repetitionAssembler(originalEvent: Object, repetition: { [key: string]: any }): any {
    const customizer = (originalParam: any, repetitionParam: any): any => {
      if (repetitionParam === null) {
        return originalParam;
      }
  
  
      if (typeof repetitionParam === 'object' && typeof originalParam === 'object') {
        /**
         * If original event has null but repetition has some value, we need to return repetition value
         */
        if (originalParam === null) {
          return repetitionParam;
          /**
           * Otherwise, we need to recursively merge original and repetition values
           */
        } else {
          return repetitionAssembler(originalParam, repetitionParam);
        }
      }
  
      return repetitionParam;
    };
  
    return mergeWith(cloneDeep(originalEvent), cloneDeep(repetition), customizer);
  }
  

/**
 * Helps to merge original event and repetition due to delta format,
 * in case of old delta format, we need to patch the payload
 * in case of new delta format, we need to assemble the payload
 *
 * @param originalEvent {HawkEvent} - The original event
 * @param repetition {HawkEventRepetition} - The repetition to process
 * @returns {HawkEvent} Updated event with processed repetition payload
 */
export function composeFullRepetitionEvent(originalEvent: HawkEvent, repetition: HawkEventRepetition | undefined): HawkEvent {

    console.log('originalEvent', originalEvent);
    console.log('repetition', repetition);

    /**
     * Make a deep copy of the original event, because we need to avoid mutating the original event
     */
    const event = cloneDeep(originalEvent);
  
    if (!repetition) {
      return event;
    }
  
    /**
     * New delta format (repetition.delta is not null)
     */
    if (repetition.delta) {
      event.payload = patch({
        left: event.payload,
        delta: JSON.parse(repetition.delta)
      });
  
      return event;
    }
  
    /**
     * New delta format (repetition.payload is null) and repetition.delta is null (there is no delta between original and repetition)
     */
    if (!repetition.payload) {
      return event;
    }
  
    /**
     * Old delta format (repetition.payload is not null)
     * @todo remove after July 5 2025
     */
    event.payload = repetitionAssembler(event.payload, repetition.payload);
  
    return event;
  }
  