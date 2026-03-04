/**
 * Dual-write to unified events collection (API layer)
 *
 * When USE_UNIFIED_EVENTS_COLLECTIONS=true, duplicates updates to the unified
 * events collection. Errors are logged, not thrown.
 *
 * @see docs/mongodb-unified-collections/
 */

const { ObjectId } = require('mongodb');
const { incrementDualWriteFailure } = require('../../metrics/dualWrite');

const EVENTS_COLLECTION = 'events';

function isUnifiedEnabled() {
  return process.env.USE_UNIFIED_EVENTS_COLLECTIONS === 'true';
}

function getEventsDb() {
  const mongo = require('../../mongo');
  return mongo.databases?.events;
}

/**
 * Add user to visitedBy in unified events collection
 *
 * @param {string} projectId - project ObjectId
 * @param {string} eventId - event ObjectId
 * @param {string} userId - user ObjectId
 */
async function visitEventUnified(projectId, eventId, userId) {
  if (!isUnifiedEnabled()) return;

  try {
    const db = getEventsDb();
    if (!db) return;

    await db.collection(EVENTS_COLLECTION).updateOne(
      { projectId: new ObjectId(projectId), _id: new ObjectId(eventId) },
      { $addToSet: { visitedBy: new ObjectId(userId) } }
    );
  } catch (err) {
    incrementDualWriteFailure('events');
    console.error('[dualWrite] visitEventUnified failed', { projectId, eventId, err });
  }
}

/**
 * Toggle event mark (resolved, ignored, starred) in unified events collection
 *
 * @param {string} projectId - project ObjectId
 * @param {string} eventId - event ObjectId
 * @param {string} mark - mark name (e.g. 'resolved', 'ignored', 'starred')
 * @param {boolean} isUnset - if true, remove mark; if false, set mark with timestamp
 */
async function toggleEventMarkUnified(projectId, eventId, mark, isUnset) {
  if (!isUnifiedEnabled()) return;

  try {
    const db = getEventsDb();
    if (!db) return;

    const markKey = `marks.${mark}`;
    const update = isUnset
      ? { $unset: { [markKey]: '' } }
      : { $set: { [markKey]: Math.floor(Date.now() / 1000) } };

    await db.collection(EVENTS_COLLECTION).updateOne(
      { projectId: new ObjectId(projectId), _id: new ObjectId(eventId) },
      update
    );
  } catch (err) {
    incrementDualWriteFailure('events');
    console.error('[dualWrite] toggleEventMarkUnified failed', { projectId, eventId, mark, err });
  }
}

/**
 * Update assignee in unified events collection
 *
 * @param {string} projectId - project ObjectId
 * @param {string} eventId - event ObjectId
 * @param {string} assignee - assignee user id or '' to unassign
 */
async function updateAssigneeUnified(projectId, eventId, assignee) {
  if (!isUnifiedEnabled()) return;

  try {
    const db = getEventsDb();
    if (!db) return;

    await db.collection(EVENTS_COLLECTION).updateOne(
      { projectId: new ObjectId(projectId), _id: new ObjectId(eventId) },
      { $set: { assignee } }
    );
  } catch (err) {
    incrementDualWriteFailure('events');
    console.error('[dualWrite] updateAssigneeUnified failed', { projectId, eventId, err });
  }
}

module.exports = {
  visitEventUnified,
  toggleEventMarkUnified,
  updateAssigneeUnified,
};
