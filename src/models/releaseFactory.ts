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
  }

  /**
   * Получить релиз по его идентификатору с использованием DataLoader
   * @param id - идентификатор релиза
   */
  public async getReleaseById(id: string): Promise<ReleaseDBScheme | null> {
    return this.dataLoaders.releaseById.load(id);
  }

  /**
   * Получить все релизы
   */
  public async getAllReleases(): Promise<ReleaseDBScheme[]> {
    return this.collection.find({}).toArray();
  }

  /**
   * Получить релизы с пагинацией
   * @param page - номер страницы (начиная с 1)
   * @param limit - количество элементов на страницу
   */
  public async getReleasesPaginated(page: number, limit: number): Promise<ReleaseDBScheme[]> {
    const skip = (page - 1) * limit;
    return this.collection.find({}).skip(skip).limit(limit).toArray();
  }

  /**
   * Получить релизы по идентификатору проекта
   * @param projectId - идентификатор проекта
   */
  public async getReleasesByProjectId(projectId: string): Promise<ReleaseDBScheme[]> {
    return this.collection.find({ projectId }).toArray();
  }
}
