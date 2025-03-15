import { Collection, Db } from 'mongodb';
import { ReleaseDBScheme } from '@hawk.so/types';
import DataLoaders from '../dataLoaders';

export default class ReleasesFactory {
  /**
   * Коллекция релизов
   */
  private collection: Collection<ReleaseDBScheme>;

  /**
   * DataLoader для релизов
   */
  private dataLoaders: DataLoaders;

  /**
   * Создаёт экземпляр фабрики релизов
   * @param dbConnection - подключение к базе данных
   * @param dataLoaders - экземпляр DataLoaders для батчинга запросов
   */
  constructor(dbConnection: Db, dataLoaders: DataLoaders) {
    this.collection = dbConnection.collection('releases');
    this.dataLoaders = dataLoaders;
    console.log("[ReleasesFactory] Initialized with collection 'releases'");
  }

  /**
   * Получить релиз по его идентификатору с использованием DataLoader
   * @param id - идентификатор релиза
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
   * Получить все релизы
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
   * Получить релизы с пагинацией
   * @param page - номер страницы (начиная с 1)
   * @param limit - количество элементов на страницу
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
   * Получить релизы по идентификатору проекта
   * @param projectId - идентификатор проекта
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
