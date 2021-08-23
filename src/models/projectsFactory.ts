import AbstractModelFactory from './abstactModelFactory';
import { Collection, Db } from 'mongodb';
import DataLoaders from '../dataLoaders';
import ProjectModel from './project';
import ProjectToWorkspace from './projectToWorkspace';
import uuid from 'uuid';
import { ProjectDBScheme } from 'hawk.types';
import generateIntegrationToken from '../utils/generateIntegrationToken';

/**
 * Users factory to work with User Model
 */
export default class ProjectsFactory extends AbstractModelFactory<ProjectDBScheme, ProjectModel> {
  /**
   * DataBase collection to work with
   */
  protected collection: Collection<ProjectDBScheme>;

  /**
   * DataLoaders for fetching data from database
   */
  private dataLoaders: DataLoaders;

  /**
   * Creates projects factory instance
   * @param dbConnection - connection to DataBase
   * @param dataLoaders - dataLoaders for fetching data
   */
  constructor(dbConnection: Db, dataLoaders: DataLoaders) {
    super(dbConnection, ProjectModel);
    this.collection = dbConnection.collection('projects');
    this.dataLoaders = dataLoaders;
  }

  /**
   * Finds project by its id
   * @param id - user id
   */
  public async findById(id: string): Promise<ProjectModel | null> {
    const projectData = await this.dataLoaders.projectById.load(id);

    if (!projectData) {
      return null;
    }

    return new ProjectModel(projectData);
  }

  /**
   * Get projects list by their ids
   * @param ids - workspaces ids to fetch
   */
  public async findManyByIds(ids: string[]): Promise<ProjectDBScheme[]> {
    return (await this.dataLoaders.projectById.loadMany(ids))
      .map((data) => !data || data instanceof Error ? null : new ProjectModel(data))
      .filter(Boolean) as ProjectModel[];
  }

  /**
   * Creates new project in DataBase
   * @param projectData - project data for creation
   */
  public async create(projectData: ProjectDBScheme): Promise<ProjectModel> {
    const projectId = (await this.collection.insertOne(projectData)).insertedId;

    const integrationId = uuid.v4();

    const encodedIntegrationToken = generateIntegrationToken(integrationId);

    const result = await this.collection.findOneAndUpdate(
      { _id: projectId },
      {
        $set: {
          integrationId,
          token: encodedIntegrationToken,
        },
      },
      { returnOriginal: false }
    );

    if (!result.value) {
      throw new Error('Can\'t create project due to unknown error');
    }

    // Create Project to Workspace relationship
    await new ProjectToWorkspace(projectData.workspaceId).add({
      projectId: projectId,
    });

    return new ProjectModel(result.value);
  }
}
