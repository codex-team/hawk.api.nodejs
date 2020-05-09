import argon2 from 'argon2';
import crypto from 'crypto';
import jwt, { Secret } from 'jsonwebtoken';
import { OptionalId } from '../mongo';
import { Collection, ObjectId } from 'mongodb';
import AbstractModel from './abstractModel';
import objectHasOnlyProps from '../utils/objectHasOnlyProps';
import { NotificationsChannelsDBScheme } from '../types/notification-channels';

/**
 * Tokens pair for User authentication.
 * Authorization by access token and refreshing pair by refresh token (after access token was expired).
 */
export interface TokensPair {
  /**
   * User's access token
   */
  accessToken: string;

  /**
   * User's refresh token for getting new tokens pair
   */
  refreshToken: string;
}

/**
 * Membership collection DB implementation
 */
export interface MembershipDBScheme {
  /**
   * Document id
   */
  _id: ObjectId;

  /**
   * User's workspace id
   */
  workspaceId: ObjectId;

  /**
   * Shows if member is pending
   */
  isPending?: boolean;
}

/**
 * Interface representing how user is stored in DB
 */
export interface UserDBScheme {
  /**
   * User's id
   */
  _id: ObjectId;

  /**
   * User's email
   */
  email?: string;

  /**
   * User's password
   */
  password?: string;

  /**
   * User's image url
   */
  image?: string;

  /**
   * User's name
   */
  name?: string;

  /**
   * User's GitHub profile id
   */
  githubId?: string;

  /**
   * User's original password (this field appears only after registration).
   * Using to send password to user after registration
   */
  generatedPassword?: string;

  /**
   * User notifications settings
   */
  notifications: UserNotificationsDBScheme;
}

/**
 * This structure represents how user notifications are stored at the DB (in 'users' collection)
 */
export interface UserNotificationsDBScheme {
  /**
   * Channels with their settings
   */
  channels: NotificationsChannelsDBScheme;

  /**
   * Types of notifications to receive
   */
  whatToReceive: {[key in UserNotificationType]: boolean};
}

/**
 * Available options of 'What to receive'
 */
export enum UserNotificationType {
  /**
   * When user is assigned to the issue (event)
   */
  IssueAssigning = 'IssueAssigning',

  /**
   * Regular digest of what happened on the project for the week
   */
  WeeklyDigest = 'WeeklyDigest',

  /**
   * Only important messages from Hawk team
   */
  SystemMessages = 'SystemMessages',
}

/**
 * User model
 */
export default class UserModel extends AbstractModel<UserDBScheme> implements UserDBScheme {
  /**
   * User's id
   */
  public _id!: ObjectId;

  /**
   * User's email
   */
  public email?: string;

  /**
   * User's password
   */
  public password?: string;

  /**
   * User's image url
   */
  public image?: string;

  /**
   * User's name
   */
  public name?: string;

  /**
   * User's GitHub profile id
   */
  public githubId?: string;

  /**
   * User's original password (this field appears only after registration).
   * Using to send password to user after registration
   */
  public generatedPassword?: string;

  /**
   * User notifications settings
   */
  public notifications!: UserNotificationsDBScheme;

  /**
   * Model's collection
   */
  protected collection: Collection<UserDBScheme>;

  /**
   * Collection of user's workspaces
   */
  private membershipCollection: Collection<MembershipDBScheme>;

  /**
   * Model constructor
   * @param modelData - user data
   */
  constructor(modelData: UserDBScheme) {
    super(modelData);

    this.membershipCollection = this.dbConnection.collection('membership:' + this._id);
    this.collection = this.dbConnection.collection<UserDBScheme>('users');
  }

  /**
   * Generate 16bytes password
   */
  public static generatePassword(): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(8, (err, buff) => {
        if (err) {
          return reject(err);
        }

        resolve(buff.toString('hex'));
      });
    });
  }

  /**
   * Hash password
   * @param password - password to hash
   */
  public static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }

  /**
   * Change user's password
   * Hashes new password and updates the document
   *
   * @param userId - user ID
   * @param newPassword - new user password
   */
  public async changePassword(newPassword: string): Promise<void> {
    const hashedPassword = await UserModel.hashPassword(newPassword);

    const status = await this.update(
      { _id: new ObjectId(this._id) },
      { password: hashedPassword }
    );

    if (status !== 1) {
      throw new Error("Can't change password");
    }
  }

  /**
   * Update user profile data
   * @param userId - user ID
   * @param  user – user object
   */
  public async updateProfile(user: Partial<UserDBScheme>): Promise<void> {
    if (!await objectHasOnlyProps(user, {
      name: true,
      email: true,
      image: true,
      notifications: true,
    })) {
      throw new Error('User object has invalid properties');
    }

    try {
      await this.update(
        { _id: new ObjectId(this._id) },
        user
      );
    } catch (e) {
      throw new Error('Can\'t update profile');
    }
  }

  /**
   * Generates JWT
   */
  public async generateTokensPair(): Promise<TokensPair> {
    const accessToken = await jwt.sign(
      {
        userId: this._id,
      },
      process.env.JWT_SECRET_ACCESS_TOKEN as Secret,
      { expiresIn: '15m' }
    );

    const refreshToken = await jwt.sign(
      {
        userId: this._id,
      },
      process.env.JWT_SECRET_REFRESH_TOKEN as Secret,
      { expiresIn: '30d' }
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Compare unhashed password with user's password
   * @param password - password to check
   */
  public async comparePassword(password: string): Promise<boolean> {
    if (!this.password) {
      return false;
    }

    return argon2.verify(this.password, password);
  }

  /**
   * Adds new workspace to the user's membership list
   * @param workspaceId - user's id to add
   * @param isPending - if true, mark user's membership as pending
   */
  public async addWorkspace(workspaceId: string, isPending = false): Promise<object> {
    const doc: OptionalId<MembershipDBScheme> = {
      workspaceId: new ObjectId(workspaceId),
    };

    if (isPending) {
      doc.isPending = isPending;
    }

    const documentId = (await this.membershipCollection.insertOne(doc)).insertedId;

    return {
      id: documentId,
      workspaceId,
    };
  }

  /**
   * Remove workspace from membership collection
   * @param workspaceId - id of workspace to remove
   */
  public async removeWorkspace(workspaceId: string): Promise<{workspaceId: string}> {
    await this.membershipCollection.deleteOne({
      workspaceId: new ObjectId(workspaceId),
    });

    return {
      workspaceId,
    };
  }

  /**
   * Confirm membership of workspace by id
   * @param workspaceId - workspace id to confirm
   */
  public async confirmMembership(workspaceId: string): Promise<void> {
    await this.membershipCollection.updateOne(
      {
        workspaceId: new ObjectId(workspaceId),
      },
      { $unset: { isPending: '' } }
    );
  }

  /**
   * Get user's workspaces ids
   * Returns all user's workspaces if ids = []
   * @param ids - workspaces id to filter them if there are workspaces that doesn't belong to the user
   */
  public async getWorkspacesIds(ids: (string | ObjectId)[] = []): Promise<string[]> {
    const idsAsObjectId = ids.map(id => new ObjectId(id));
    const searchQuery = ids.length ? {
      workspaceId: {
        $in: idsAsObjectId,
      },
    } : {};

    const membershipDocuments = await this.membershipCollection.find(searchQuery).toArray();

    return membershipDocuments.map(doc => doc.workspaceId.toString());
  }
}
