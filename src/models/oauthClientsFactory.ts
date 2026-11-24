import { Collection, Db, ObjectId, OptionalId } from 'mongodb';
import AbstractModelFactory from './abstactModelFactory';
import OAuthClientModel from './oauthClient';

import type { OAuthClientDBScheme } from '@hawk.so/types';

export default class OAuthClientsFactory extends AbstractModelFactory<OptionalId<OAuthClientDBScheme>, OAuthClientModel> {
  protected collection: Collection<OptionalId<OAuthClientDBScheme>>;

  constructor(dbConnection: Db) {
    super(dbConnection, OAuthClientModel);
    this.collection = dbConnection.collection('oauthClients');
  }

  /**
   * Creates new oauth client
   * @param userId Id of the user the client will be associated with
   * @param clientId Id of the client
   * @returns oauth client unique identifier or null
   */
  public async create(userId: string, clientId: string): Promise<string | null> {
    const jti = await OAuthClientModel.generateJti();
    const oauthClient = await this.collection.insertOne({
      userId,
      clientId,
      jti,
      createdAt: new Date(),
      lable: 'MCP token',
      lastUsedAt: null,
      permissions: ['read', 'write'],
      requestCount: 0,
    });

    return oauthClient.insertedId.toString();
  }

  /**
   * Refreshes oauth client unique jwt id
   * @param oauthId Unique oauth client identifier
   * @returns `true` if update was successfull, `false` if something went wrong
   */
  public async refreshJti(oauthId: string) {
    const newJti = await OAuthClientModel.generateJti();
    const result = await this.collection.updateOne({
      _id: new ObjectId(oauthId),
    }, { $set: { jti: newJti } });

    return !!result.acknowledged;
  }

  /**
   * Tracks token usage.
   * Updates `lastUsedAt` and increases `requestCount`
   * @param oauthId
   * @returns `true` if update was successfull, `false` if something went wrong
   */
  public async trackUse(oauthId: string) {
    const result = await this.collection.updateOne(
      { _id: new ObjectId(oauthId) },
      {
        $inc: { requestCount: 1 },
        $set: { lastUsedAt: new Date() },
      }
    );

    return !!result.acknowledged;
  }
}
