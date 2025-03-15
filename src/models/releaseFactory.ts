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
    console.log("[ReleasesFactory] Initialized with collection 'releases'");
  }

  /**
   * Get a release by its identifier using DataLoader
   * @param id - release identifier
   */
  public async getReleaseById(id: string): Promise<ReleaseDBScheme | null> {
    console.log(`[ReleasesFactory] getReleaseById called with id: ${id}`);
    try {
      const release = await this.dataLoaders.releaseById.load(id);
      console.log(`[ReleasesFactory] getReleaseById result:`, release);
      return release;
    } catch (error) {
      console.error(`[ReleasesFactory] Error in getReleaseById:`, error);
      throw error;
    }
  }

  /**
   * Get all releases
   */
  public async getAllReleases(): Promise<ReleaseDBScheme[]> {
    console.log(`[ReleasesFactory] getAllReleases called`);
    try {
      const releases = await this.collection.find({}).toArray();
      console.log(`[ReleasesFactory] getAllReleases returned ${releases.length} releases`);
      return releases;
    } catch (error) {
      console.error(`[ReleasesFactory] Error in getAllReleases:`, error);
      throw error;
    }
  }

  /**
   * Get releases with pagination
   * @param page - page number (starting from 1)
   * @param limit - number of items per page
   */
  public async getReleasesPaginated(page: number, limit: number): Promise<ReleaseDBScheme[]> {
    const skip = (page - 1) * limit;
    console.log(`[ReleasesFactory] getReleasesPaginated called with page: ${page}, limit: ${limit}, skip: ${skip}`);
    try {
      const releases = await this.collection.find({}).skip(skip).limit(limit).toArray();
      console.log(`[ReleasesFactory] getReleasesPaginated returned ${releases.length} releases`);
      return releases;
    } catch (error) {
      console.error(`[ReleasesFactory] Error in getReleasesPaginated:`, error);
      throw error;
    }
  }

  /**
   * Get releases by project identifier
   * @param projectId - project identifier
   */
  public async getReleasesByProjectId(projectId: string): Promise<ReleaseDBScheme[]> {
    console.log(`[ReleasesFactory] getReleasesByProjectId called with projectId: ${projectId}`);
    try {
      const releases = await this.collection.find({ projectId: projectId }).toArray();
      console.log(`[ReleasesFactory] getReleasesByProjectId returned ${releases.length} releases`);
      return releases;
    } catch (error) {
      console.error(`[ReleasesFactory] Error in getReleasesByProjectId:`, error);
      throw error;
    }
  }
}
