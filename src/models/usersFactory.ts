import AbstractModelFactory from './abstactModelFactory';
import UserModel, { UserDBScheme } from './user';
import { Collection, Db } from 'mongodb';
import DataLoaders from '../dataLoaders';

/**
 * Users factory to work with User Model
 */
export default class UsersFactory extends AbstractModelFactory<UserDBScheme, UserModel> {
  /**
   * DataBase collection to work with
   */
  protected collection: Collection<UserDBScheme>;

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
   */
  public async create(email: string): Promise<UserModel> {
    const generatedPassword = await UserModel.generatePassword();
    const hashedPassword = await UserModel.hashPassword(generatedPassword);

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

    const userId = (await this.collection.insertOne(userData)).insertedId;

    return new UserModel({
      _id: userId,
      ...userData,
    });
  }
}
