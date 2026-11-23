import { Collection, Db, OptionalId } from "mongodb";
import AbstractModelFactory from "./abstactModelFactory";
import OAuthClientModel from "./oauthClient";

import type { OAuthClientDBScheme } from "@hawk.so/types";

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
   * @returns JWT identifier or null
   */
  public async create(userId: string, clientId: string): Promise<string | null> {
    const jti = await OAuthClientModel.generateJti();
    await this.collection.insertOne({
      userId,
      clientId,
      jti,
      createdAt: new Date(),
      lable: 'MCP token',
      lastUsedAt: null,
      permissions: ['read', 'write'],
      requestCount: 0,
    });

    return jti;
  }

  /**
   * Refreshes 
   * @param userId 
   * @param currentJti 
   */
  public async refreshJti(userId: string, currentJti: string) {
    const newJti = await OAuthClientModel.generateJti();
    const result = await this.collection.updateOne({
      userId,
      jti: currentJti
    }, { $set: { jti: newJti } });

    return result.matchedCount > 0 ? newJti : null
  }

  /**
   * 
   * @param userId 
   * @param currentJti 
   * @returns 
   */
  public async trackUse(userId: string, currentJti: string) {
    const result = await this.collection.updateOne(
      { userId, jti: currentJti },
      {
        $inc: { requestCount: 1 },
        $set: { lastUsedAt: new Date() }
      },
      {  }
    );

    return result.matchedCount > 0 ? true : false;
  }
}
