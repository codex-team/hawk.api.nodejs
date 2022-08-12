import type { MembershipDBScheme, WorkspaceDBScheme } from '@hawk.so/types';
import { accountsMongoDb } from '../lib/mongodb.js';

/**
 * Represents workspace and all actions for workspaces
 */
export default class WorkspaceModel {
  /**
   * Collection with workspaces
   */
  public static workspacesCollection = accountsMongoDb.db().collection<WorkspaceDBScheme>('workspaces');

  /**
   * Workspace data
   */
  public data: WorkspaceDBScheme;

  /**
   * WorkspaceModel constructor
   *
   * @param data - workspace data
   */
  constructor(data: WorkspaceDBScheme) {
    this.data = data;
  }

  /**
   * Get all workspaces for user (wrapped in WorkspaceModel)
   */
  public static async findAllByUserId(userId: string, raw: false): Promise<WorkspaceModel[]>;

  /**
   * Get all workspaces for user (raw data from database)
   */
  public static async findAllByUserId(userId: string, raw: true): Promise<WorkspaceDBScheme[]>;

  /**
   * Find all workspaces for user
   *
   * @param userId - user id to find workspaces for
   * @param raw - return raw data instead of model instances
   */
  public static async findAllByUserId(userId: string, raw = false): Promise<WorkspaceModel[] | WorkspaceDBScheme[]> {
    const membershipCollection = accountsMongoDb.db().collection<MembershipDBScheme>('membership:' + userId);

    const memberships = await membershipCollection
      .find({})
      .toArray();

    const workspacesIds = memberships.map(membership => membership.workspaceId);

    const workspaces = await WorkspaceModel.workspacesCollection.find({ _id: { $in: workspacesIds } }).toArray();

    if (raw) {
      console.log(workspaces);

      return workspaces;
    }

    return workspaces.map(workspace => new WorkspaceModel(workspace));
  }
}
