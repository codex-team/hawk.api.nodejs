import type { Collection, Db, ObjectId } from 'mongodb';
import type { ReleaseDBScheme } from '@hawk.so/types';

/**
 * ReleasesFactory
 * Helper for accessing releases collection
 */
export default class ReleasesFactory {
  /**
   * DataBase collection to work with
   */
  private readonly collection: Collection<ReleaseDBScheme>;

  /**
   * Creates releases factory instance
   * @param dbConnection - connection to Events DB
   */
  constructor(dbConnection: Db) {
    this.collection = dbConnection.collection<ReleaseDBScheme>('releases');
  }

  /**
   * Find one release document by projectId and release label.
   * Tries both exact string match and numeric fallback (if release can be cast to number).
   */
  public async findByProjectAndRelease(
    projectId: string | ObjectId,
    release: string
  ): Promise<ReleaseDBScheme | null> {
    const projectIdStr = projectId.toString();

    // Try exact match as stored
    let doc = await this.collection.findOne({
      projectId: projectIdStr,
      release: release as ReleaseDBScheme['release'],
    });

    // Fallback if release stored as number
    if (!doc) {
      const asNumber = Number(release);

      if (!Number.isNaN(asNumber)) {
        doc = await this.collection.findOne({
          projectId: projectIdStr,
          release: asNumber as unknown as ReleaseDBScheme['release'],
        });
      }
    }

    return doc;
  }
}
