import AbstractModelFactory from './abstactModelFactory';
import UserModel, { UserDBScheme } from './user';
import { Collection, Db } from 'mongodb';

export default class UsersFactory extends AbstractModelFactory<UserDBScheme, UserModel> {
  public collection!: Collection<UserDBScheme>;

  constructor(dbConnection: Db, collectionName: string) {
    super(dbConnection, collectionName, UserModel);
  }

  /**
   * Finds user by his email
   * @param email - user's email
   */
  async findByEmail(email: string): Promise<UserModel | null> {
    const searchResult = await this.collection.findOne({ email });

    if (!searchResult) {
      return null;
    }

    return new UserModel(searchResult);
  }

  /**
   * Creates new user in DB and returns it
   * @param email - user email
   */
  async create(email: string): Promise<UserModel> {
    // @todo normal password generation
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
}
