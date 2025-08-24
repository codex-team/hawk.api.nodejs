import mergeWith from 'lodash.mergewith';
import cloneDeep from 'lodash.clonedeep';
import { patch } from '@n1ru4l/json-patch-plus';
import { GroupedEventDBScheme, RepetitionDBScheme } from '@hawk.so/types';

/**
 * One of the features of the events is that their repetition is the difference
 * between the original, which greatly optimizes storage. So we need to restore
 * the original repetition payload using the very first event and its difference
 * between its repetition
 *
 * @deprecated remove after 6 september 2025
 * @param originalEvent - the very first event we received
 * @param repetition - the difference with its repetition, for the repetition we want to display
 * @returns fully assembled payload of the current repetition
 */
export function repetitionAssembler(originalEvent: GroupedEventDBScheme['payload'], repetition: GroupedEventDBScheme['payload']): GroupedEventDBScheme['payload'] {
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
 * Parse addons and context fields from string to object, in db it stores as string
 *
 * @param payload - the payload of the event
 * @param field - the field to parse, can be 'addons' or 'context'
 * @returns the payload with parsed field
 */
function parsePayloadField(payload: GroupedEventDBScheme['payload'], field: 'addons' | 'context') {
  if (payload && payload[field] && typeof payload[field] === 'string') {
    payload[field] = JSON.parse(payload[field] as string);
  }

  return payload;
}

/**
 * Stringify addons and context fields from object to string, in db it stores as string
 *
 * @param payload - the payload of the event
 * @param field - the field to stringify, can be 'addons' or 'context'
 * @returns the payload with stringified field
 */
function stringifyPayloadField(payload: GroupedEventDBScheme['payload'], field: 'addons' | 'context') {
  if (payload && payload[field]) {
    payload[field] = JSON.stringify(payload[field]);
  }

  return payload;
}

/**
 * Helps to merge original event payload and repetition due to delta format,
 * in case of old delta format, we need to patch the payload
 * in case of new delta format, we need to assemble the payload
 *
 * @param originalEventPayload {GroupedEventDBScheme['payload']} - The original event payload
 * @param repetition {RepetitionDBScheme} - The repetition to process
 * @returns {GroupedEventDBScheme['payload']} Updated event with processed repetition payload
 */
export function composeEventPayloadByRepetition(originalEventPayload: GroupedEventDBScheme['payload'], repetition: RepetitionDBScheme | undefined): GroupedEventDBScheme['payload'] {
  /**
   * Make a deep copy of the original event, because we need to avoid mutating the original event
   */
  let result = cloneDeep(originalEventPayload);

  if (!repetition) {
    return result;
  }

  /**
   * New delta format (repetition.delta is not null)
   */
  if (repetition.delta) {
    /**
     * Parse addons and context fields from string to object before patching
     */
    result = parsePayloadField(result, 'addons');
    result = parsePayloadField(result, 'context');

    result = patch({
      left: result,
      delta: JSON.parse(repetition.delta),
    });

    /**
     * Stringify addons and context fields from object to string after patching
     */
    result = stringifyPayloadField(result, 'addons');
    result = stringifyPayloadField(result, 'context');

    return result;
  }

  /**
   * New delta format (repetition.payload is null) and repetition.delta is null (there is no delta between original and repetition)
   */
  if (!repetition.payload) {
    return result;
  }

  /**
   * Old delta format (repetition.payload is not null)
   * @todo remove after 6 september 2025
   */
  result = repetitionAssembler(result, repetition.payload);

  return result;
}
