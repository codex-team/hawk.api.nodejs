import { Collection, ObjectId } from 'mongodb';
import AbstractModel from './abstractModel';
import { OptionalId } from '../mongo';
import UserModel from './user';

/**
 * Workspace representation in DataBase
 */
export interface WorkspaceDBScheme {
  /**
   * Workspace's id
   */
  _id: ObjectId;

  /**
   * Workspace's name
   */
  name: string;

  /**
   * Workspace's description
   */
  description?: string;

  /**
   * Workspace's image URL
   */
  image?: string;
}

/**
 * Team Document DataBase representation
 */
export interface TeamMemberDBScheme {
  /**
   * Document id
   */
  _id: ObjectId;

  /**
   * Id of the member of workspace
   * If null, user is invited via email and still pending
   */
  userId?: ObjectId;

  /**
   * User email for invitation
   */
  userEmail?: string;

  /**
   * Is user admin in workspace
   */
  isAdmin?: boolean;

  /**
   * Is user pending (did not accept the invitation)
   */
  isPending?: boolean;
}

/**
 * Workspace model
 */
export default class WorkspaceModel extends AbstractModel<WorkspaceDBScheme> implements WorkspaceDBScheme {
  /**
   * Workspace's id
   */
  public _id!: ObjectId;

  /**
   * Workspace's name
   */
  public name!: string;

  /**
   * Workspace's description
   */
  public description?: string;

  /**
   * Workspace's image URL
   */
  public image?: string;

  /**
   * Model's collection
   */
  protected collection: Collection<WorkspaceDBScheme>;

  /**
   * Collection with information about team for workspace
   */
  protected teamCollection: Collection<TeamMemberDBScheme>;

  /**
   * Creates Workspace instance
   * @param workspaceData - workspace's data
   */
  constructor(workspaceData: WorkspaceDBScheme) {
    super(workspaceData);
    this.collection = this.dbConnection.collection<WorkspaceDBScheme>('workspaces');
    this.teamCollection = this.dbConnection.collection<TeamMemberDBScheme>('team:' + this._id.toString());
  }

  /**
   * Update workspace data
   * @param workspaceData – workspace data
   */
  public async updateWorkspace(workspaceData: WorkspaceDBScheme): Promise<void> {
    try {
      await this.update(
        { _id: new ObjectId(this._id) },
        workspaceData
      );
    } catch (e) {
      throw new Error('Can\'t update workspace');
    }
  }

  /**
   * Adds new member to the workspace team
   * @param {String} memberId - user's id to add
   * @param {boolean} isPending - if true, mark member as pending
   */
  public async addMember(memberId: string, isPending = false): Promise<TeamMemberDBScheme> {
    const doc: OptionalId<TeamMemberDBScheme> = {
      userId: new ObjectId(memberId),
      isPending,
    };

    const documentId = (await this.teamCollection.insertOne(doc)).insertedId;

    return {
      _id: documentId,
      userId: new ObjectId(memberId),
      isPending,
    };
  }

  /**
   * Grant admin permissions to the member
   * @param memberId - id of member to grant permissions
   * @param state - state of permissions
   */
  public async grantAdmin(memberId: string, state = true): Promise<void> {
    await this.collection.updateOne(
      {
        userId: new ObjectId(memberId),
      },
      {
        $set: { isAdmin: state },
      }
    );
  }

  /**
   * Remove member from workspace
   * @param member - member to remove
   */
  public async removeMember(member: UserModel): Promise<void> {
    await this.teamCollection.deleteOne({
      userId: new ObjectId(member._id),
    });
    await member.removeWorkspace(this._id.toString());
  }

  /**
   * Remove member from workspace by email
   * @param memberEmail - email of member to remove
   */
  public async removeMemberByEmail(memberEmail: string): Promise<void> {
    await this.teamCollection.deleteOne({
      userEmail: memberEmail,
    });
  }

  /**
   * Add unregistered member to the workspace
   * @param memberEmail - invited member`s email
   */
  public async addUnregisteredMember(memberEmail: string): Promise<TeamMemberDBScheme> {
    const foundDocument = await this.teamCollection.findOne({ userEmail: memberEmail });

    if (foundDocument) {
      throw new Error('User is already invited to this workspace');
    }

    const documentId = (await this.teamCollection.insertOne({
      userEmail: memberEmail,
      isPending: true,
    })).insertedId;

    return {
      _id: documentId,
      userEmail: memberEmail,
      isPending: true,
    };
  }

  /**
   * Confirm membership of user
   * @param member - member for whom confirm membership
   */
  public async confirmMembership(member: UserModel): Promise<boolean> {
    const { matchedCount, modifiedCount } = await this.collection.updateOne(
      {
        userId: new ObjectId(member._id.toString()),
      },
      { $unset: { isPending: '' } }
    );

    if (matchedCount > 0 && modifiedCount === 0) {
      throw new Error('User is already confirmed the invitation');
    }

    if (!matchedCount) {
      await this.collection.updateOne(
        {
          userEmail: member.email,
        },
        {
          $set: { userId: new ObjectId(member._id.toString()) },
          $unset: {
            userEmail: '',
            isPending: '',
          },
        }
      );

      return false;
    }

    return true;
  }

  /**
   * Returns all users data in the team
   */
  public async getAllMembersInfo(): Promise<TeamMemberDBScheme[]> {
    return this.teamCollection.find({}).toArray();
  }

  /**
   * Returns all pending users
   */
  public async getPendingMembersInfo(): Promise<TeamMemberDBScheme[]> {
    return (await this.teamCollection.find({}).toArray())
      .filter(doc => doc.isPending);
  }

  /**
   * Get workspace team description
   */
  public async getTeam(): Promise<TeamMemberDBScheme[]> {
    return this.teamCollection.find({}).toArray();
  }

  /**
   * Get member description for certain workspace
   * @param memberId - id of the member to get info
   */
  public getMemberInfo(memberId: string): Promise<TeamMemberDBScheme | null> {
    return this.teamCollection.findOne({
      userId: new ObjectId(memberId),
    });
  }
}
