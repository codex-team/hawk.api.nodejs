// TODO: it would be great to move release logic from another factories/resolvers to this class
import type { Collection, Db, ObjectId } from 'mongodb';
import type { ReleaseDBScheme } from '@hawk.so/types';

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

  /**
   * Find files by release id
   * @param fileIds - file ids
   * @returns files
   */
  public async findFilesByFileIds(fileIds: ObjectId[]): Promise<ReleaseFileDBScheme[]> {
    return this.filesCollection.find({ _id: { $in: fileIds } }).toArray();
  }
}
