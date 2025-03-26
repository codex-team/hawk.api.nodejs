import { Collection, Db} from 'mongodb';
import { ReleaseDBScheme, SourceMapFileChunk } from '@hawk.so/types';
import DataLoaders from '../dataLoaders';

interface ReleaseWithFileDetails extends ReleaseDBScheme {
  fileDetails?: SourceMapFileChunk[];
}

export default class ReleasesFactory {
  /**
   * Releases collection
   */
  private collection: Collection<ReleaseDBScheme>;

  /**
   * DataLoader for releases
   */
  private dataLoaders: DataLoaders;

  /**
   * Creates an instance of the releases factory
   * @param dbConnection - database connection
   * @param dataLoaders - DataLoaders instance for request batching
   */
  constructor(dbConnection: Db, dataLoaders: DataLoaders) {
    this.collection = dbConnection.collection('releases');
    this.dataLoaders = dataLoaders;
  }

  /**
   * Get releases by project identifier with file sizes
   * @param projectId - project identifier
   */
  public async findManyByProjectId(projectId: string): Promise<ReleaseDBScheme[]> {
    try {
      const releases = await this.collection.aggregate<ReleaseWithFileDetails>([
        {
          $match: {
            projectId: projectId,
          },
        },
        {
          $lookup: {
            from: 'releases.files',
            let: { fileIds: '$files._id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ['$_id', '$$fileIds'],
                  },
                },
              },
              {
                $project: {
                  _id: 1,
                  length: 1,
                  chunkSize: 1,
                },
              },
            ],
            as: 'fileDetails',
          },
        },
      ]).toArray();

      return releases.map(release => this.enrichReleaseWithFileSizes(release));
    } catch (error) {
      console.error(`[ReleasesFactory] Error in findManyByProjectId:`, error);
      throw error;
    }
  }

  /**
   * Enriches release with file sizes from file details
   * @param release - release with file details
   * @returns enriched release
   */
  private enrichReleaseWithFileSizes(release: ReleaseWithFileDetails): ReleaseDBScheme {
    const fileDetailsMap = new Map(
      release.fileDetails?.map(detail => [detail._id.toString(), detail.length]) || []
    );

    return {
      ...release,
      files: release.files?.map(file => ({
        ...file,
        size: fileDetailsMap.get(file._id?.toString() || '') || 0,
      })),
    };
  }
}
