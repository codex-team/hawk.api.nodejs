import AbstractModelFactory from './abstactModelFactory';
import { Collection, Db } from 'mongodb';
import { InviteModel, InviteDBScheme } from './invite';
import DataLoaders from '../dataLoaders';

/**
 * Invite factory to work with InviteModel
 */
export default class InvitesFactory extends AbstractModelFactory<InviteDBScheme, InviteModel> {
  /**
   * DataBase collection to work with invites
   */
  protected collection: Collection<InviteDBScheme>;

  /**
   * DataLoaders for fetching data from database
   */
  private dataLoaders: DataLoaders;

  /**
   * Creates invites factory instance
   * @param dbConnection - connection to DataBase
   * @param dataLoaders - dataLoaders for fetching data
   */
  constructor(dbConnection: Db, dataLoaders: DataLoaders) {
    super(dbConnection, InviteModel);
    this.collection = dbConnection.collection('invites');
    this.dataLoaders = dataLoaders;
  }

  /**
   * Finds invite by its id
   * @param id - user id
   */
  public async findById(id: string): Promise<InviteModel | null> {
    const inviteData = await this.dataLoaders.inviteById.load(id);

    if (!inviteData) {
      return null;
    }

    return new InviteModel(inviteData);
  }

  /**
   * Get Invites list by their ids
   * @param ids - invites ids to fetch
   */
  public async findManyByIds(ids: string[]): Promise<InviteModel[]> {
    return (await this.dataLoaders.inviteById.loadMany(ids))
      .map((data) => !data || data instanceof Error ? null : new InviteModel(data))
      .filter(Boolean) as InviteModel[];
  }

  /**
   * Creates new invite in DB
   * @param inviteData - invite's data (if memberId is not set then it is general invite for this workspace)
   */
  public async create(inviteData: InviteDBScheme): Promise<InviteModel> {
    const inviteId = (await this.collection.insertOne(inviteData)).insertedId;

    return new InviteModel({
      ...inviteData,
      _id: inviteId,
    });
  }

  /**
   * Finds invite by its hash
   * @param inviteHash - invite hash
   */
  public async findByHash(inviteHash: string): Promise<InviteModel | null> {
    const inviteData = await this.dataLoaders.inviteByHash.load(inviteHash);

    if (!inviteData) {
      return null;
    }

    return new InviteModel(inviteData);
  }

  /**
   * Get Invites list by their hashes
   * @param inviteHashes - invites ids to fetch
   */
  public async findManyByHashes(inviteHashes: string[]): Promise<InviteModel[]> {
    return (await this.dataLoaders.inviteByHash.loadMany(inviteHashes))
      .map((data) => !data || data instanceof Error ? null : new InviteModel(data))
      .filter(Boolean) as InviteModel[];
  }

  /**
   * Get Invites list by their workspaces ids
   * @param workspaceIds - workspaces ids to fetch
   */
  public async findManyByWorkspaceIds(workspaceIds: string[]): Promise<InviteModel[]> {
    return (await this.dataLoaders.inviteByHash.loadMany(workspaceIds))
      .map((data) => !data || data instanceof Error ? null : new InviteModel(data))
      .filter(Boolean) as InviteModel[];
  }

  /**
   * Get valid invite by their workspaces id
   * @param workspaceId - workspace id to fetch
   */
  public async findValidByWorkspaceId(workspaceId: string): Promise<InviteModel | null> {
    const invites = (await this.dataLoaders.inviteByHash.loadMany(workspaceId))
      .map((data) => !data || data instanceof Error || data.isRevoked ? null : new InviteModel(data))
      .filter(Boolean) as InviteModel[];

    if (!invites) {
      return null;
    }

    if (invites.length > 1) {
      console.error(`${workspaceId} has ${invites.length} general links`);
    }

    return invites[0];
  }
}
