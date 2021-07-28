import AbstractModelFactory from './abstactModelFactory';
import { Collection, Db } from 'mongodb';
import WorkspaceModel from './workspace';
import DataLoaders from '../dataLoaders';
import UserModel from './user';
import PlansFactory from './plansFactory';
import PlanModel from './plan';
import { WorkspaceDBScheme } from 'hawk.types';

/**
 * Workspaces factory to work with WorkspaceModel
 */
export default class WorkspacesFactory extends AbstractModelFactory<WorkspaceDBScheme, WorkspaceModel> {
  /**
   * DataBase collection to work with
   */
  protected collection: Collection<WorkspaceDBScheme>;

  /**
   * DataLoaders for fetching data from database
   */
  private dataLoaders: DataLoaders;

  /**
   * Creates workspaces factory instance
   * @param dbConnection - connection to DataBase
   * @param dataLoaders - dataLoaders for fetching data
   */
  constructor(dbConnection: Db, dataLoaders: DataLoaders) {
    super(dbConnection, WorkspaceModel);
    this.collection = dbConnection.collection('workspaces');
    this.dataLoaders = dataLoaders;
  }

  /**
   * Finds workspace by its id
   * @param id - user id
   */
  public async findById(id: string): Promise<WorkspaceModel | null> {
    const workspaceData = await this.dataLoaders.workspaceById.load(id);

    if (!workspaceData) {
      return null;
    }

    return new WorkspaceModel(workspaceData);
  }

  /**
   * Creates new workspace in DB
   * @param workspaceData - workspace's data
   * @param ownerModel - owner of the new workspace
   */
  public async create(workspaceData: WorkspaceDBScheme, ownerModel: UserModel): Promise<WorkspaceModel> {
    workspaceData = {
      ...workspaceData,
      inviteHash: WorkspaceModel.generateInviteHash(),
    };

    const workspaceId = (await this.collection.insertOne(workspaceData)).insertedId;

    const workspaceModel = new WorkspaceModel({
      ...workspaceData,
      _id: workspaceId,
    });

    await workspaceModel.addMember(ownerModel._id.toString());
    await workspaceModel.grantAdmin(ownerModel._id.toString());
    await ownerModel.addWorkspace(workspaceModel._id.toString());
    await workspaceModel.changePlan((await this.getDefaultPlan())._id.toString());

    return workspaceModel;
  }

  /**
   * Get Workspaces list by their ids
   * @param ids - workspaces ids to fetch
   */
  public async findManyByIds(ids: string[]): Promise<WorkspaceModel[]> {
    return (await this.dataLoaders.workspaceById.loadMany(ids))
      .map((data) => !data || data instanceof Error ? null : new WorkspaceModel(data))
      .filter(Boolean) as WorkspaceModel[];
  }

  /**
   * Returns workspace by its subscription id
   *
   * @param subscriptionId - subscription id from payment system
   */
  public async findBySubscriptionId(subscriptionId: string): Promise<WorkspaceModel | null> {
    const workspaceData = await this.collection.findOne({ subscriptionId });

    return workspaceData && new WorkspaceModel(workspaceData);
  }

  /**
   * Returns workspace by its invite hash
   *
   * @param inviteHash - workspace invite hash
   */
  public async findByInviteHash(inviteHash: string): Promise<WorkspaceModel | null> {
    const workspaceData = await this.collection.findOne({ inviteHash });

    return workspaceData && new WorkspaceModel(workspaceData);
  }

  /**
   * Get default plan to be used for new projects
   */
  private async getDefaultPlan(): Promise<PlanModel> {
    const plansFactory = new PlansFactory(this.dbConnection, this.dataLoaders);

    return plansFactory.getDefaultPlan();
  }
}
