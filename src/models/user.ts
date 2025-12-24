import argon2 from 'argon2';
import crypto from 'crypto';
import jwt, { Secret } from 'jsonwebtoken';
import { Collection, ObjectId, OptionalId } from 'mongodb';
import AbstractModel from './abstractModel';
import objectHasOnlyProps from '../utils/objectHasOnlyProps';
import { NotificationsChannelsDBScheme } from '../types/notification-channels';
import { BankCard, UserDBScheme } from '@hawk.so/types';
import { v4 as uuid } from 'uuid';

/**
 * Utility type for making specific fields optional
 */
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

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
export type MembershipDBScheme = Record<string, {
  isPending?: boolean;
}>;

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
  whatToReceive: { [key in UserNotificationType]: boolean };
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
 * This structure represents how user projects last visit is stored at the DB (in 'users' collection)
 */
type UserProjectsLastVisitDBScheme = Record<string, number>;

/**
 * User model
 */
export default class UserModel extends AbstractModel<Omit<UserDBScheme, '_id'>> implements UserDBScheme {
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
   * User's workspaces
   */
  public workspaces!: MembershipDBScheme;

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
   * User projects last visit
   */
  public projectsLastVisit!: UserProjectsLastVisitDBScheme;

  /**
   * Saved bank cards for one-click payments
   */
  public bankCards?: BankCard[];

  /**
   * UTM parameters from signup - Data form where user went to sign up. Used for analytics purposes
   */
  public utm?: UserDBScheme['utm'];

  /**
   * External identities for SSO (keyed by workspaceId)
   */
  public identities?: {
    [workspaceId: string]: {
      saml: {
        /**
         * NameID value from IdP (stable identifier)
         */
        id: string;

        /**
         * Email at the time of linking (for audit)
         */
        email: string;
      };
    };
  };

  /**
   * Model's collection
   */
  protected collection: Collection<Omit<UserDBScheme, '_id'>>;

  /**
   * Model constructor
   * @param modelData - user data
   */
  constructor(modelData: OptionalId<UserDBScheme>) {
    /**
     * Fallback for name using email
     */
    if (modelData.email && !modelData.name) {
      modelData.name = modelData.email;
    }

    super(modelData);

    this.collection = this.dbConnection.collection('users');
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
   * Compose default notifications settings for new users.
   *
   * @param email - user email from the sign-up form will be used as email-channel endpoint
   */
  public static generateDefaultNotificationsSettings(email: string): UserNotificationsDBScheme {
    return {
      channels: {
        email: {
          endpoint: email,
          isEnabled: true,
          minPeriod: 0,
        },
      },
      whatToReceive: {
        IssueAssigning: true,
        WeeklyDigest: true,
        SystemMessages: true,
      },
    };
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
   * Update user's last project visit
   *
   * @param projectId - project id
   * @returns {Promise<number>} - last project visit timestamp
   */
  public async updateLastProjectVisit(projectId: string): Promise<number> {
    const time = Date.now() / 1000;

    await this.update(
      { _id: new ObjectId(this._id) },
      { [`projectsLastVisit.${projectId}`]: time }
    );

    return time;
  }

  /**
   * Get user's last project visit
   *
   * @param projectId - project id
   * @returns {Promise<number>} - last project visit timestamp
   */
  public async getLastProjectVisit(projectId: string): Promise<number> {
    return this.projectsLastVisit?.[projectId] || 0;
  }

  /**
   * Update user profile data
   * @param  user – user object
   */
  public async updateProfile(user: Partial<UserDBScheme>): Promise<void> {
    if (!await objectHasOnlyProps(user, {
      name: true,
      email: true,
      image: true,
      notifications: true,
      'notifications.channels.email.endpoint': true,
    })) {
      throw new Error('User object has invalid properties');
    }

    try {
      await this.update(
        { _id: new ObjectId(this._id) },
        user
      );
    } catch (e) {
      console.error(e);
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
  public async addWorkspace(workspaceId: string, isPending = false): Promise<{ workspaceId: string }> {
    await this.update(
      { _id: new ObjectId(this._id) },
      { [`workspaces.${workspaceId}`]: { isPending } }
    );

    return {
      workspaceId,
    };
  }

  /**
   * Remove workspace from membership collection
   * @param workspaceId - id of workspace to remove
   */
  public async removeWorkspace(workspaceId: string): Promise<{ workspaceId: string }> {
    await this.collection.updateOne(
      { _id: new ObjectId(this._id) },
      { $unset: { [`workspaces.${workspaceId}`]: '' } }
    );

    return {
      workspaceId,
    };
  }

  /**
   * Confirm membership of workspace by id
   * @param workspaceId - workspace id to confirm
   */
  public async confirmMembership(workspaceId: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(this._id) },
      { $unset: { [`workspaces.${workspaceId}.isPending`]: '' } }
    );
  }

  /**
   * Get user's workspaces ids
   * Returns all user's workspaces if ids = []
   * @param ids - workspaces id to filter them if there are workspaces that doesn't belong to the user
   */
  public async getWorkspacesIds(ids: (string | ObjectId)[] = []): Promise<string[]> {
    const res = [];

    if (ids.length === 0) {
      if (!this.workspaces) {
        return [];
      }

      return Object.keys(this.workspaces);
    }

    if (!this.workspaces) {
      return [];
    }

    for (const id of ids) {
      const workspaceId = id.toString();
      const workspace = this.workspaces[workspaceId];

      if (workspace && workspace.isPending !== true) {
        res.push(workspaceId);
      }
    }

    return res;
  }

  /**
   * Saves new back card of the user
   * @param cardData - card data to save
   */
  public async saveNewBankCard(cardData: PartialBy<BankCard, 'id'>): Promise<void> {
    const userWithProvidedCard = await this.collection.findOne({
      _id: this._id,
      'bankCards.token': cardData.token,
    });

    if (userWithProvidedCard) {
      return;
    }

    await this.collection.updateOne({
      _id: this._id,
    }, {
      $push: {
        bankCards: {
          id: uuid(),
          ...cardData,
        },
      },
    });
  }

  /**
   * Link SAML identity to user for specific workspace
   *
   * @param workspaceId - workspace ID
   * @param samlId - NameID value from IdP (stable identifier)
   * @param email - user email at the time of linking
   */
  public async linkSamlIdentity(workspaceId: string, samlId: string, email: string): Promise<void> {
    /**
     * Use Record<string, any> for MongoDB dot notation keys
     */
    const updateData: Record<string, any> = {
      [`identities.${workspaceId}.saml.id`]: samlId,
      [`identities.${workspaceId}.saml.email`]: email,
    };

    await this.update(
      { _id: new ObjectId(this._id) },
      updateData
    );

    /**
     * Update local state
     */
    if (!this.identities) {
      this.identities = {};
    }
    if (!this.identities[workspaceId]) {
      this.identities[workspaceId] = { saml: { id: samlId, email } };
    } else {
      this.identities[workspaceId].saml = { id: samlId, email };
    }
  }

  /**
   * Get SAML identity for workspace
   *
   * @param workspaceId - workspace ID
   * @returns SAML identity or null if not found
   */
  public getSamlIdentity(workspaceId: string): { id: string; email: string } | null {
    return this.identities?.[workspaceId]?.saml || null;
  }
}
