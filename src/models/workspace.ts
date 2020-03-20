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
 * Represents confirmed member info in DB
 */
interface ConfirmedMemberDBScheme {
  /**
   * Document id
   */
  _id: ObjectId;

  /**
   * Id of the member of workspace
   */
  userId: ObjectId;

  /**
   * Is user admin in workspace
   */
  isAdmin?: boolean;
}

/**
 * Represents pending member info in DB
 */
interface PendingMemberDBScheme {
  /**
   * Document id
   */
  _id: ObjectId;

  /**
   * User email for invitation
   */
  userEmail: string;
}

/**
 * Represents full structure of team collection documents
 */
type MemberDBScheme = ConfirmedMemberDBScheme | PendingMemberDBScheme;

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
  protected teamCollection: Collection<MemberDBScheme>;

  /**
   * Creates Workspace instance
   * @param workspaceData - workspace's data
   */
  constructor(workspaceData: WorkspaceDBScheme) {
    super(workspaceData);
    this.collection = this.dbConnection.collection<WorkspaceDBScheme>('workspaces');
    this.teamCollection = this.dbConnection.collection<MemberDBScheme>('team:' + this._id.toString());
  }

  /**
   * Checks is provided document represents pending member
   * @param doc - doc to check
   */
  public static isPendingMember(doc: MemberDBScheme): doc is PendingMemberDBScheme {
    return !!(doc as PendingMemberDBScheme).userEmail && !(doc as ConfirmedMemberDBScheme).userId;
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
   */
  public async addMember(memberId: string): Promise<ConfirmedMemberDBScheme> {
    const doc: OptionalId<ConfirmedMemberDBScheme> = {
      userId: new ObjectId(memberId),
    };

    const documentId = (await this.teamCollection.insertOne(doc)).insertedId;

    return {
      _id: documentId,
      userId: new ObjectId(memberId),
    };
  }

  /**
   * Grant admin permissions to the member
   * @param memberId - id of member to grant permissions
   * @param state - state of permissions
   */
  public async grantAdmin(memberId: string, state = true): Promise<void> {
    await this.teamCollection.updateOne(
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
  public async addUnregisteredMember(memberEmail: string): Promise<PendingMemberDBScheme> {
    const foundDocument = await this.teamCollection.findOne({ userEmail: memberEmail });

    if (foundDocument) {
      throw new Error('User is already invited to this workspace');
    }

    const documentId = (await this.teamCollection.insertOne({
      userEmail: memberEmail,
    } as PendingMemberDBScheme)).insertedId;

    return {
      _id: documentId,
      userEmail: memberEmail,
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

    const isUserAlreadyConfirmedInvitation = matchedCount > 0 && modifiedCount === 0;

    if (isUserAlreadyConfirmedInvitation) {
      throw new Error('User is already confirmed the invitation');
    }

    /**
     * In case user was invited via email instead of invite link
     */
    if (matchedCount > 0) {
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
  public async getAllMembersInfo(): Promise<MemberDBScheme[]> {
    return this.teamCollection.find({}).toArray();
  }

  /**
   * Returns all pending users
   */
  public async getPendingMembersInfo(): Promise<PendingMemberDBScheme[]> {
    return (await this.teamCollection.find({}).toArray())
      .filter(doc => WorkspaceModel.isPendingMember(doc)) as PendingMemberDBScheme[];
  }

  /**
   * Get workspace team description
   */
  public async getTeam(): Promise<ConfirmedMemberDBScheme[]> {
    return (await this.teamCollection.find({}).toArray())
      .filter(doc => !WorkspaceModel.isPendingMember(doc)) as ConfirmedMemberDBScheme[];
  }

  /**
   * Get member description for certain workspace
   * @param memberId - id of the member to get info
   */
  public getMemberInfo(memberId: string): Promise<MemberDBScheme | null> {
    return this.teamCollection.findOne({
      userId: new ObjectId(memberId),
    });
  }
}
