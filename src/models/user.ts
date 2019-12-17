import argon2 from 'argon2';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import * as mongo from '../mongo';
import { Collection, ObjectID } from 'mongodb';
import BaseModel from './abstractModel';
import objectHasOnlyProps from '../utils/objectHasOnlyProps';

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
export default class UserModel extends BaseModel<UserDBScheme> implements UserDBScheme {
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
  protected static get collection(): Collection<UserDBScheme> {
    return mongo.databases.hawk!.collection('users');
  }

  /**
   * Creates new user in DB and returns its details
   * @param email - user email
   */
  public static async create(email: string): Promise<UserModel> {
    // @todo normal password generation
    const generatedPassword = await this.generatePassword();
    const hashedPassword = await this.hashPassword(generatedPassword);

    const userData = {
      email,
      password: hashedPassword,
    };
    const userId = (await this.collection.insertOne(userData)).insertedId;

    const user = new UserModel({
      _id: userId,
      ...userData,
    });

    user.generatedPassword = generatedPassword;

    return user;
  }

  /**
   * Creates new user id DB by GitHub provider
   * @param id - GitHub profile id
   * @param name - GitHub profile name
   * @param image - GitHub profile avatar url
   */
  public static async createByGithub({ id, name, image }: { id: string; name: string; image: string }): Promise<UserModel> {
    if (!id || !name || !image) {
      throw new Error('Required parameters are not provided');
    }

    const userData = {
      githubId: id,
      name,
      image,
    };

    const userId = (await this.collection.insertOne(userData)).insertedId;

    return new UserModel({
      _id: userId,
      ...userData,
    });
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
   * Change user's password
   * Hashes new password and updates the document
   *
   * @param userId - user ID
   * @param newPassword - new user password
   */
  public static async changePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await this.hashPassword(newPassword);

    const status = await this.update(
      { _id: new ObjectID(userId) },
      { password: hashedPassword }
    );

    if (status !== 1) {
      throw new Error("Can't change password");
    }
  }

  /**
   * Update user profile data
   *
   * @param userId - user ID
   * @param  user – user object
   */
  public static async updateProfile(userId: string, user: UserDBScheme): Promise<void> {
    if (!await objectHasOnlyProps(user, {
      name: true,
      email: true,
      image: true,
    })) {
      throw new Error('User object has invalid properties');
    }

    try {
      await this.update(
        { _id: new ObjectID(userId) },
        user
      );
    } catch (e) {
      throw new Error('Can\'t update profile');
    }
  }

  /**
   * Returns User by its id
   * @param id - user id
   */
  public static async findById(id: string): Promise<UserModel | null> {
    const searchResult = await this.collection.findOne({ _id: new ObjectID(id) });

    if (!searchResult) {
      return null;
    }

    return new UserModel(searchResult);
  }

  /**
   * Finds user by his email
   * @param email - user's email
   */
  public static async findByEmail(email: string): Promise<UserModel | null> {
    const searchResult = await this.collection.findOne({ email });

    if (!searchResult) {
      return null;
    }

    return new UserModel(searchResult);
  }

  /**
   * Hash password
   * @param password - password to hash
   */
  private static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
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
}
