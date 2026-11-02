/**
 * TODO: it would be great to move release logic from another factories/resolvers to this class
 */
import type { Collection, Db, ObjectId } from 'mongodb';
import type { ReleaseDBScheme } from '@hawk.so/types';
import { normalizeReleaseName } from '../utils/releaseName';

/**
 * Interface representing how release files are stored in the DB
 */
export interface ReleaseFileDBScheme {
  /**
   * File's id
   */
  _id: ObjectId;

  /**
   * File length in bytes
   */
  length: number;

  /**
   * File upload date
   */
  uploadDate: Date;

  /**
   * File chunk size
   */
  chunkSize: number;

  /**
   * File map name
   */
  filename: string;

  /**
   * File MD5 hash
   */
  md5: string;
}

/**
 * ReleasesFactory
 * Helper for accessing releases collection
 */
export default class ReleasesFactory {
  /**
   * DataBase collection to work with
   */
  private readonly collection: Collection<ReleaseDBScheme>;
  private readonly filesCollection: Collection<ReleaseFileDBScheme>;

  /**
   * Creates releases factory instance
   * @param dbConnection - connection to Events DB
   */
  constructor(dbConnection: Db) {
    this.collection = dbConnection.collection<ReleaseDBScheme>('releases');
    this.filesCollection = dbConnection.collection<ReleaseFileDBScheme>('releases.files');
  }

  /**
   * Compare against the newest valid registered release, not the newest observed/deployed release.
   * @param projectId - event's project
   * @param firstSeenRelease - original event's release name
   * @param latestReleaseCache - caller-owned request cache keyed by project ID; shares in-flight lookups
   * and null results (including failures) only within that request. Without it, every call reads afresh.
   * @returns whether the original first appeared in the newest valid registered release, or false on failure
   */
  public async isNewInLatestRelease(
    projectId: string | ObjectId | null | undefined,
    firstSeenRelease: unknown,
    latestReleaseCache?: Map<string, Promise<string | null>>
  ): Promise<boolean> {
    try {
      const name = normalizeReleaseName(firstSeenRelease);

      if (!projectId || name === null) {
        return false;
      }
      const key = projectId.toString();
      let latest = latestReleaseCache?.get(key);

      if (!latest) {
        latest = this.findLatestValidRelease(key);
        if (latestReleaseCache) {
          latestReleaseCache.set(key, latest);
        }
      }

      return name === await latest;
    } catch (error) {
      console.error('Failed to compare event release with latest registered release', error);

      return false;
    }
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

    /*
     * Try exact match as stored
     */
    let doc = await this.collection.findOne({
      projectId: projectIdStr,
      release: release as ReleaseDBScheme['release'],
    });

    /*
     * Fallback if release stored as number
     */
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

  /**
   * Find files by file ids
   * @param fileIds - file ids
   * @returns files
   */
  public async findFilesByFileIds(fileIds: ObjectId[]): Promise<ReleaseFileDBScheme[]> {
    return this.filesCollection.find({ _id: { $in: fileIds } }).toArray();
  }

  /**
   * Read newest first, skipping legacy invalid names without materializing the release history.
   * Failures resolve to null so concurrent rows share one logged failure, not rejected promises.
   * @param projectId - normalized project ID
   * @returns newest valid release name, or null if none exists or the lookup fails
   */
  private async findLatestValidRelease(projectId: string): Promise<string | null> {
    try {
      /*
       * The existing index bounds the project, but does not cover the _id sort.
       */
      const cursor = this.collection.find({ projectId }, {
        sort: { _id: -1 },
        projection: {
          release: 1,
          _id: 0,
        },
        hint: {
          projectId: 1,
          release: 1,
        },
      });

      try {
        for await (const doc of cursor) {
          const name = normalizeReleaseName(doc.release);

          if (name !== null) {
            return name;
          }
        }
      } finally {
        await cursor.close();
      }
    } catch (error) {
      console.error(`Failed to look up latest registered release for project ${projectId}`, error);
    }

    return null;
  }
}
