import type { TokensPair, UserDBScheme, UserNotificationsDBScheme } from '@hawk.so/types';
import { accountsMongoDb } from '../lib/mongodb.js';
import { MongoServerError, ObjectId } from 'mongodb';
import { generateTokensPair } from '../lib/auth-tokens.js';
import { comparePasswords, generatePassword, hashPassword } from '../lib/crypto.js';

/**
 * Represents user and all actions for user
 */
class UserModel {
  /**
   * Collection with users
   */
  public static usersCollection = accountsMongoDb.db().collection<UserDBScheme>('users');

  /**
   * User data
   */
  public data: UserDBScheme;

  /**
   * User constructor
   *
   * @param data - user data
   */
  constructor(data: UserDBScheme) {
    this.data = data;
  }

  /**
   * Returns user by his id
   *
   * @param id - user id to find
   */
  public static async findById(id: string): Promise<UserModel | null> {
    const data = await this.usersCollection.findOne({ _id: new ObjectId(id) });

    if (!data) {
      return null;
    }

    return new UserModel(data);
  }

  /**
   * Hash password
   *
   * @param password - password to hash
   */
  public static async hashPassword(password: string): Promise<string> {
    return hashPassword(password);
  }

  /**
   * Creates new user by email and password
   *
   * @param email - user email
   * @param password - user password (optional, will be generated if not provided)
   */
  public static async createByEmail(email: string, password?: string): Promise<[UserModel, string]> {
    const generatedPassword = password || await UserModel.generatePassword();
    const hashedPassword = await UserModel.hashPassword(generatedPassword);

    const userData = {
      email,
      password: hashedPassword,
      notifications: UserModel.generateDefaultNotificationsSettings(email),
    };

    try {
      const userId = (await this.usersCollection.insertOne(userData as UserDBScheme)).insertedId;

      const user = new UserModel({
        _id: userId,
        ...userData,
      });

      return [user, generatedPassword];
    } catch (e) {
      if (e instanceof MongoServerError) {
        const MONGODB_DUPLICATE_KEY_ERROR_CODE = 11000;

        if (e.code === MONGODB_DUPLICATE_KEY_ERROR_CODE) {
          throw new Error('User with this email already exists');
        }
      }
      throw e;
    }
  }


  /**
   * Compose default notifications settings for new users.
   *
   * @param email - user email from the sign-up form will be used as email-channel endpoint
   */
  private static generateDefaultNotificationsSettings(email: string): UserNotificationsDBScheme {
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
   * Generates new password for user
   */
  private static async generatePassword(): Promise<string> {
    return generatePassword();
  }

  /**
   * Generates JWT
   */
  public async generateTokensPair(): Promise<TokensPair> {
    return generateTokensPair(this.data._id.toString());
  }


  /**
   * Compare non-hashed password with user's password
   *
   * @param password - password to check
   */
  public async comparePassword(password: string): Promise<boolean> {
    if (!this.data.password) {
      return false;
    }

    return comparePasswords(this.data.password, password);
  }
}

export default UserModel;
