import { Collection, Db } from 'mongodb';
import { ReleaseDBScheme } from '@hawk.so/types';
import DataLoaders from '../dataLoaders';

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
   * Get a release by its identifier using DataLoader
   * @param releaseId - release identifier
   */
  public async findById(releaseId: string): Promise<ReleaseDBScheme | null> {
    try {
      return await this.dataLoaders.releaseById.load(releaseId);
    } catch (error) {
      console.error(`[ReleasesFactory] Error in findById:`, error);
      throw error;
    }
  }

  /**
   * Get releases by project identifier
   * @param projectId - project identifier
   */
  public async findManyByProjectId(projectId: string): Promise<ReleaseDBScheme[]> {
    try {
      return await this.collection.find({ projectId: projectId }).toArray();
    } catch (error) {
      console.error(`[ReleasesFactory] Error in findManyByProjectId:`, error);
      throw error;
    }
  }
}
