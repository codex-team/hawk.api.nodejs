import AbstractModelFactory from './abstactModelFactory';
import UserModel from './user';
import { Collection, Db, OptionalId } from 'mongodb';
import DataLoaders from '../dataLoaders';
import { UserDBScheme } from '@hawk.so/types';
import { Analytics, AnalyticsEventTypes } from '../utils/analytics';

/**
 * Users factory to work with User Model
 */
export default class UsersFactory extends AbstractModelFactory<Omit<UserDBScheme, '_id'>, UserModel> {
  /**
   * DataBase collection to work with
   */
  protected collection: Collection<Omit<UserDBScheme, '_id'>>;

  /**
   * DataLoaders for fetching data from database
   */
  private dataLoaders: DataLoaders;

  /**
   * Creates user factory instance
   * @param dbConnection - connection to DataBase
   * @param dataLoaders - dataLoaders for fetching data
   */
  constructor(dbConnection: Db, dataLoaders: DataLoaders) {
    super(dbConnection, UserModel);
    this.collection = dbConnection.collection('users');
    this.dataLoaders = dataLoaders;
  }

  /**
   * Finds user by his email
   * @param email - user's email
   */
  public async findByEmail(email: string): Promise<UserModel | null> {
    const userData = await this.dataLoaders.userByEmail.load(email);

    if (!userData) {
      return null;
    }

    return new UserModel(userData);
  }

  /**
   * Finds user by its id
   * @param id - user id
   */
  public async findById(id: string): Promise<UserModel | null> {
    const userData = await this.dataLoaders.userById.load(id);

    if (!userData) {
      return null;
    }

    return new UserModel(userData);
  }

  /**
   * Creates new user in DB and returns it
   * @param email - user email
   * @param password - user password
   * @param utm - Data form where user went to sign up. Used for analytics purposes
   */
  public async create(
    email: string,
    password?: string,
    utm?: UserDBScheme['utm']
  ): Promise<UserModel> {
    const generatedPassword = password || (await UserModel.generatePassword());
    const hashedPassword = await UserModel.hashPassword(generatedPassword);

    const userData: OptionalId<UserDBScheme> = {
      email,
      password: hashedPassword,
      notifications: UserModel.generateDefaultNotificationsSettings(email),
    };

    if (utm && Object.keys(utm).length > 0) {
      userData.utm = utm;
    }

    const userId = (await this.collection.insertOne(userData)).insertedId;

    const user = new UserModel({
      _id: userId,
      ...userData,
    });

    user.generatedPassword = generatedPassword;

    await Analytics.logEvent({
      /* eslint-disable-next-line camelcase */
      event_type: AnalyticsEventTypes.NEW_USER_REGISTERED,
      /* eslint-disable-next-line camelcase */
      user_id: userId.toString(),
      time: Date.now(),
    });

    return user;
  }

  /**
   * Creates new user id DB by GitHub provider
   * @param id - GitHub profile id
   * @param name - GitHub profile name
   * @param image - GitHub profile avatar url
   */
  public async createByGithub(
    { id, name, image }: { id: string; name: string; image: string }
  ): Promise<UserModel> {
    if (!id || !name || !image) {
      throw new Error('Required parameters are not provided');
    }

    const userData = {
      githubId: id,
      name,
      image,
    };

    const userId = (await this.collection.insertOne(userData as any)).insertedId;

    return new UserModel({
      _id: userId,
      ...userData,
    });
  }

  /**
   * Get Users by their ids
   * @param ids - users ids to fetch
   */
  public async findManyByIds(ids: string[]): Promise<UserDBScheme[]> {
    return (await this.dataLoaders.userById.loadMany(ids))
      .map((data) => !data || data instanceof Error ? null : new UserModel(data))
      .filter(Boolean) as UserModel[];
  }

  /**
   * Delete's user by email
   *
   * @param email - user email
   */
  public async deleteByEmail(email: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ email: email });

    return result.acknowledged;
  }

  /**
   * Find user by SAML identity
   *
   * @param workspaceId - workspace ID
   * @param samlId - NameID value from IdP
   * @returns UserModel or null if not found
   */
  public async findBySamlIdentity(workspaceId: string, samlId: string): Promise<UserModel | null> {
    const userData = await this.collection.findOne({
      [`identities.${workspaceId}.saml.id`]: samlId,
    });

    return userData ? new UserModel(userData) : null;
  }
}
