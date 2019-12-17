import argon2 from 'argon2';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import * as mongo from '../mongo';
import {Collection, ObjectID} from 'mongodb';
import BaseModel from './abstractModel';
import objectHasOnlyProps from '../utils/objectHasOnlyProps';


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
   * User's original password (this field appears only after registration)
   */
  generatedPassword?: string;
}

/**
 * User model
 */
export default class UserModel extends BaseModel<UserDBScheme> implements UserDBScheme {
    _id!: string | ObjectID;
    email?: string | undefined;
    password?: string | undefined;
    image?: string | undefined;
    name?: string | undefined;
    githubId?: string | undefined;
    generatedPassword?: string | undefined;

  /**
   * Creates User instance
   * @param userData - user's data
   */
  constructor(userData: UserDBScheme) {
    super(userData);
  }

  /**
   * Model's collection
   */
  static get collection(): Collection<UserDBScheme> {
    return mongo.databases.hawk!.collection('users');
  }

  /**
   * Creates new user in DB
   * @param {String} email - user email
   * @returns {Promise<UserModel>} - user details
   */
  static async create(email: string): Promise<UserModel> {
    // @todo normal password generation
    const generatedPassword = await this.generatePassword();
    const hashedPassword = await this.hashPassword(generatedPassword);

    const userData = {email, password: hashedPassword};
    const userId = (await this.collection.insertOne(userData)).insertedId;

    const user = new UserModel({
      _id: userId,
      ...userData
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
  static async createByGithub({id, name, image}: {id: string, name: string, image: string}) {
    if (!id || !name || !image) {
      throw new Error('Required parameters are not provided');
    }

    const userData = {githubId: id, name, image};

    const userId = (await this.collection.insertOne(userData)).insertedId;

    return new UserModel({
      _id: userId,
      ...userData
    });
  }

  /**
   * Generate 16bytes password
   */
  static generatePassword(): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(8, (err, buff) => {
        if (err) return reject(err);
        resolve(buff.toString('hex'));
      });
    });
  }

  /**
   * Hash password
   * @param password - password to hash
   */
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }

  /**
   * Change user's password
   * Hashes new password and updates the document
   *
   * @param userId - user ID
   * @param newPassword - new user password
   */
  static async changePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await this.hashPassword(newPassword);

    const status = await this.update(
      {_id: new ObjectID(userId)},
      {password: hashedPassword}
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
  static async updateProfile(userId: string, user: UserDBScheme): Promise<void> {
    if (!await objectHasOnlyProps(user, {name: true, email: true, image: true})) {
      throw new Error('User object has invalid properties');
    }

    try {
      await this.update(
        {_id: new ObjectID(userId)},
        user
      );
    } catch (e) {
      throw new Error('Can\'t update profile');
    }
  }

  /**
   * Finds user by his email
   * @param email - user's email
   */
  static async findByEmail(email:string): Promise<UserModel | null> {
    const searchResult = await this.collection.findOne({email});

    if (!searchResult) return null;

    return new UserModel(searchResult);
  }

  /**
   * Generates JWT
   */
  async generateTokensPair(): Promise<TokensPair> {
    const accessToken = await jwt.sign(
      {
        userId: this._id
      },
      process.env.JWT_SECRET,
      {expiresIn: '15m'}
    );

    const refreshToken = await jwt.sign(
      {
        userId: this._id
      },
      process.env.JWT_SECRET,
      {expiresIn: '30d'}
    );

    return {accessToken, refreshToken};
  }

  /**
   * Compare unhashed password with user's password
   * @param password - password to check
   */
  async comparePassword(password: string): Promise<boolean> {
    if (!this.password) {
      return false;
    }
    return argon2.verify(this.password, password);
  }

  static async findById(id: string): Promise<UserModel | null> {
    const searchResult = await this.collection.findOne({_id: new ObjectID(id)});

    if (!searchResult) return null;

    return new UserModel(searchResult);
  }

}

module.exports = UserModel;
