import argon2 from 'argon2';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OptionalId } from '../mongo';
import { Collection, ObjectID } from 'mongodb';
import Team from '../models/team';
import AbstractModel from './abstractModel';
import objectHasOnlyProps from '../utils/objectHasOnlyProps';
import {ApolloError} from "apollo-server-errors";

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
  _id: ObjectID;

  /**
   * User's workspace id
   */
  workspaceId: ObjectID | string;

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
  _id: string | ObjectID;

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
}

/**
 * User model
 */
export default class UserModel extends AbstractModel<UserDBScheme> implements UserDBScheme {
  /**
   * User's id
   */
  public _id!: string | ObjectID;

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
      { _id: new ObjectID(this._id) },
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
    })) {
      throw new Error('User object has invalid properties');
    }

    try {
      await this.update(
        { _id: new ObjectID(this._id) },
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
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = await jwt.sign(
      {
        userId: this._id,
      },
      process.env.JWT_SECRET,
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
      workspaceId: new ObjectID(workspaceId),
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
      workspaceId: new ObjectID(workspaceId),
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
        workspaceId: new ObjectID(workspaceId),
      },
      { $unset: { isPending: '' } }
    );
  }

  /**
   * Get user's workspaces by ids
   * Returns all user's workspaces if ids = []
   * @param ids - workspaces ids
   */
  public async getWorkspaces(ids: (string| ObjectID)[] = []): Promise<object> {
    ids = ids.map(id => new ObjectID(id));

    const pipeline = [
      {
        $lookup: {
          from: 'workspaces',
          localField: 'workspaceId',
          foreignField: '_id',
          as: 'workspace',
        },
      },
      {
        $match: {
          isPending: { $exists: false },
        },
      },
      {
        $unwind: '$workspace',
      },
      {
        $replaceRoot: {
          newRoot: '$workspace',
        },
      },
      {
        $lookup: {
          from: 'plans',
          localField: 'plan.name',
          foreignField: 'name',
          as: 'planInfo',
        },
      },
      {
        $unwind: {
          path: '$planInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          id: '$_id',
          'plan.monthlyCharge': '$planInfo.monthlyCharge',
          'plan.eventsLimit': '$planInfo.eventsLimit',
          planInfo: '$$REMOVE',
        },
      },
    ];

    if (ids.length) {
      return this.membershipCollection.aggregate([
        {
          $match: {
            workspaceId: {
              $in: ids,
            },
          },
        },
        ...pipeline,
      ]).toArray();
    }
    return this.membershipCollection.aggregate(pipeline).toArray();
  }

  /**
   * Leave workspace
   * @param workspaceId - id of the workspace
   * @returns {Promise<void>}
   */
  public async leaveWorkspace(workspaceId: string): Promise<void> {
    // todo: use transaction
    const team = new Team(workspaceId);

    const member = await team.getMember(this._id.toString());
    if (!member) {
       throw new ApolloError('You are not in the workspace');
    }

    const members = await team.getAllUsers();
    if (member.isAdmin){
      if (members.filter(m=>m.isAdmin).length == 1)
        throw new ApolloError('You cannot leave the workspace because you are the last admin');
      if (members.filter(m=>!m.isAdmin).length != 0)
        throw new ApolloError('You cannot leave the workspace because there are participants in it');
    }

    await team.removeMember(this._id.toString());
    await this.removeWorkspace(workspaceId);

    if (members.length == 1){
      await team.remove();
    }
  }
}
