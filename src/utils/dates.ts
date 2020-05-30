/**
 * Return timestamp for UTC midnight of the passed date
 *
 * @param {Date} date - date object
 */
export function getUTCMidnight(date: Date): number {
  return date.setUTCHours(0, 0, 0, 0);
}

/**
 * We have occurrence time and midnight in UTC, and user's timezone offset
 * We need to compute local occurrence time and its midnight
 *
 * Explanation:
 *
 *    Event accepted at 13/05 at 1:30 in UTC+3 local.
 *
 *    It means that occurrence time will be:
 *        Local 13/05/2020, 01:30:00 <-- we need to find this value
 *        UTC   12/05/2020, 22:30:00 <-- we have this value in db (lastRepetitionTime)
 *    The midnight mill be:
 *        Local 12/05/2020, 03:00:00
 *        UTC   12/05/2020, 00:00:00  <--- so event stored in 12/05 group, but user should see it at 13/05 group
 *
 *    We get 12/05/2020, 22:30:00, and compute timezone diff in hours and minutes:
 *        Hours diff:  22 - (-180/60) = 22 + 3 = 25
 *        Minutes diff: 30 - 00 = 30
 *
 *    Next, we will add hours and minutes diff to real (UTC) midnight:
 *        12/05/2020, 00:00:00 + 25 hours + 30 min = 13/05/2020, 01:30:00  <-- now we have local occurrence time
 *
 *    Then, we can compute local midnight group by local time.
 *
 *
 * @param utcOccurrenceTime - last repetition time in UTC
 * @param utcMidnight - event day's midnight in UTC
 * @param timezoneOffset - user's time zone offset (in minutes)
 *
 * @returns midnight in local timezone
 */
export function getMidnightWithTimezoneOffset(utcOccurrenceTime: number, utcMidnight: number, timezoneOffset: number): number {
  const milliseconds = 1000;
  const hour = 60;
  const timezoneOffsetHours = Math.ceil(timezoneOffset / hour);
  const timezoneOffsetMinutes = timezoneOffset % hour;

  /**
   * Compute hours and minutes diff of occurrence time
   */
  const dateOccur = new Date(utcOccurrenceTime * milliseconds);
  const hoursDiff = dateOccur.getUTCHours() - timezoneOffsetHours;
  const minutesDiff = dateOccur.getUTCMinutes() - timezoneOffsetMinutes;

  /**
   * Add computed diff to the utc midnight
   */
  const localDate = new Date(utcMidnight * milliseconds);

  localDate.setUTCHours(hoursDiff);
  localDate.setUTCMinutes(minutesDiff);

  /**
   * Now we have local occurrence time,
   * so we can get its midnight
   */
  const localMidnight = getUTCMidnight(localDate);

  return localMidnight / milliseconds;
}
