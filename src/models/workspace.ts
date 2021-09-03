import { Collection, ObjectId } from 'mongodb';
import AbstractModel from './abstractModel';
import { OptionalId } from '../mongo';
import UserModel from './user';
import { ConfirmedMemberDBScheme, MemberDBScheme, PendingMemberDBScheme, WorkspaceDBScheme } from 'hawk.types';
import crypto from 'crypto';

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
   * Randomly generated invite hash for joining to workspace via invite link
   */
  public inviteHash!: string;

  /**
   * Workspace account uuid in accounting microservice
   */
  public accountId!: string;

  /**
   * Id of the Workspace's plan
   */
  public tariffPlanId!: ObjectId;

  /**
   * Workspace balance
   */
  public balance!: number;

  /**
   * Total number of errors since the last charge date
   */
  public billingPeriodEventsCount!: number;

  /**
   * Is workspace blocked for catching new events
   */
  public isBlocked!: boolean;

  /**
   * Date when workspace was charged last time
   */

  public lastChargeDate!: Date;

  /**
   * ID of subscription if it subscribed
   * Returns from CloudPayments
   */
  public subscriptionId!: string | undefined;

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
   *
   * @param workspaceData - workspace's data
   */
  constructor(workspaceData: WorkspaceDBScheme) {
    super(workspaceData);
    this.collection = this.dbConnection.collection<WorkspaceDBScheme>('workspaces');
    this.teamCollection = this.dbConnection.collection<MemberDBScheme>('team:' + this._id.toString());
  }

  /**
   * Generates SHA-256 hash that used as invite hash
   */
  public static generateInviteHash(): string {
    return crypto
      .createHash('sha256')
      .update(crypto.randomBytes(256))
      .digest('hex');
  }

  /**
   * Checks is provided document represents pending member
   *
   * @param doc - doc to check
   */
  public static isPendingMember(doc: MemberDBScheme): doc is PendingMemberDBScheme {
    return !!(doc as PendingMemberDBScheme).userEmail && !(doc as ConfirmedMemberDBScheme).userId;
  }

  /**
   * Update workspace data
   *
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
   * Update invite hash of workspace
   * @param inviteHash - new invite hash
   */
  public async updateInviteHash(inviteHash: string): Promise<void> {
    try {
      await this.collection.updateOne(
        { _id: new ObjectId(this._id) },
        {
          $set: { inviteHash: inviteHash },
        }
      );
      this.inviteHash = inviteHash;
    } catch (e) {
      throw new Error('Can\'t update workspace');
    }
  }

  /**
   * Adds new member to the workspace team
   *
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
   *
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
   *
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
   *
   * @param memberEmail - email of member to remove
   */
  public async removeMemberByEmail(memberEmail: string): Promise<void> {
    await this.teamCollection.deleteOne({
      userEmail: memberEmail,
    });
  }

  /**
   * Add unregistered member to the workspace
   *
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
   *
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
    if (matchedCount === 0) {
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
  public async getMembers(): Promise<MemberDBScheme[]> {
    return this.teamCollection.find({}).toArray();
  }

  /**
   * Get member description for certain workspace
   *
   * @param memberId - id of the member to get info
   */
  public async getMemberInfo(memberId: string): Promise<MemberDBScheme | null> {
    return this.teamCollection.findOne({
      userId: new ObjectId(memberId),
    });
  }

  /**
   * Change plan for current workspace
   * - set tariffPlanId
   * - reset billing period events count
   * - update last charge date
   * - unblock workspace
   *
   * @param planId - id of plan to be enabled
   */
  public async changePlan(planId: ObjectId | string): Promise<number> {
    return (await this.collection.updateOne(
      {
        _id: new ObjectId(this._id),
      },
      {
        $set: {
          tariffPlanId: new ObjectId(planId),
          billingPeriodEventsCount: 0,
          isBlocked: false,
          lastChargeDate: new Date(),
        },
      }
    )).modifiedCount;
  }

  /**
   * Starts new billing period (30 days)
   */
  public async resetBillingPeriod(): Promise<void> {
    await this.collection.updateOne(
      {
        _id: new ObjectId(this._id),
      },
      {
        $set: {
          billingPeriodEventsCount: 0,
          lastChargeDate: new Date(),
        },
      }
    );
  }

  /**
   * Push old plan to plan history. So that you can trace the history of changing plans
   *
   * @param tariffPlanId - id of old plan
   * @param dtChange - date of plan change
   * @param userId - id of user that changed the plan
   * @returns whether the document was successfully updated
   */
  public async updatePlanHistory(tariffPlanId: string, dtChange: Date, userId: string): Promise<boolean> {
    return (await this.collection.updateOne(
      {
        _id: new ObjectId(this._id),
      },
      {
        $push: {
          plansHistory: {
            tariffPlanId,
            dtChange,
            userId,
          },
        },
      }
    )).modifiedCount > 0;
  }

  /**
   * Updating the date of the last charge
   *
   * @param date - date of the last charge
   * @returns whether the document was successfully updated
   */
  public async updateLastChargeDate(date: Date): Promise<boolean> {
    return (await this.collection.updateOne(
      {
        _id: new ObjectId(this._id),
      },
      {
        $set: {
          lastChargeDate: date,
        },
      }
    )).modifiedCount > 0;
  }

  /**
   * Links workspace to the specified account in accounting system
   *
   * @param accountId — account id to link
   */
  public async setAccountId(accountId: string): Promise<void> {
    this.accountId = accountId;

    await this.collection.updateOne(
      {
        _id: new ObjectId(this._id),
      },
      {
        $set: {
          accountId,
        },
      }
    );
  }

  /**
   * Saves subscription id from payment system
   *
   * @param subscriptionId — subscription id to save
   */
  public async setSubscriptionId(subscriptionId: string | null): Promise<void> {
    this.subscriptionId = subscriptionId || undefined;

    await this.collection.updateOne(
      {
        _id: new ObjectId(this._id),
      },
      {
        $set: {
          subscriptionId: this.subscriptionId,
        },
      }
    );
  }

  /**
   * Due date of the current workspace tariff plan
   */
  public getTariffPlanDueDate(): Date {
    const lastChargeDate = new Date(this.lastChargeDate);

    return new Date(lastChargeDate.setMonth(lastChargeDate.getMonth() + 1));
  }

  /**
   * Is tariff plan expired or not
   */
  public isTariffPlanExpired(): boolean {
    const date = new Date();

    return date > this.getTariffPlanDueDate();
  }
}
