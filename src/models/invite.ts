import { Collection, ObjectId } from 'mongodb';
import AbstractModel from './abstractModel';

/**
 * Invite representation in DataBase
 */
export interface InviteDBScheme {
  /**
   * Invite id
   */
  _id: ObjectId;

  /**
   * Member id - if it isn't set then then doc is general invite for specified workspace
   */
  memberId?: ObjectId;

  /**
   * Workspace id
   */
  workspaceId: ObjectId;

  /**
   * Invite hash part
   */
  hash: string;

  /**
   * If invite is revoked then nobody can join by it
   */
  isRevoked?: boolean;
}

/**
 * Invite model
 */
export class InviteModel extends AbstractModel<InviteDBScheme> implements InviteDBScheme {
  public _id!: ObjectId;

  public memberId?: ObjectId;

  public workspaceId!: ObjectId;

  public hash!: string;

  public isRevoked?: boolean;

  /**
   * Model's collection
   */
  protected collection: Collection<InviteDBScheme>;

  /**
   * Creates Invite instance
   * @param inviteData - invite's data
   */
  constructor(inviteData: InviteDBScheme) {
    super(inviteData);
    this.collection = this.dbConnection.collection<InviteDBScheme>('invites');
  }

  /**
   * Update invite data
   * @param inviteData – invite data
   */
  public async updateInvite(inviteData: InviteDBScheme): Promise<void> {
    try {
      await this.update(
        { _id: new ObjectId(this._id) },
        inviteData
      );
    } catch (e) {
      throw new Error('Can\'t update invite');
    }
  }
}
