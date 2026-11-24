import { Collection, ObjectId, OptionalId } from 'mongodb';
import jwt from "jsonwebtoken";
import AbstractModel from './abstractModel';

import type { Secret } from "jsonwebtoken";
import type { OAuthClientDBScheme, TokenPermissions, TokensPair } from '@hawk.so/types';

export default class OAuthClientModel extends AbstractModel<OptionalId<OAuthClientDBScheme>> implements OAuthClientDBScheme {
  /**
   * External client identifier
   */
  _id!: ObjectId;
  /**
   * Token owner id
   */
  userId!: string;
  /**
   * User agent id
   */
  clientId!: string;
  /**
   * Unique JSON Web Token Identifier
   */
  jti!: string;
  /**
   * What client is allowed to do
   */
  permissions!: TokenPermissions[];
  /**
   * Label set by user
   */
  lable!: string;
  /**
   * Last time the client interacted with hawk api
   */
  lastUsedAt!: Date | null;
  /**
   * Usage count
   */
  requestCount!: number;
  /**
   * Creation date
   */
  createdAt!: Date;

  public collection!: Collection<OptionalId<OAuthClientDBScheme>>;

  constructor(oauthClient: OptionalId<OAuthClientDBScheme>) {
    super(oauthClient);
    this.collection = this.dbConnection.collection<OptionalId<OAuthClientDBScheme>>('oauthClients');
  }

  public async generateTokensPair(): Promise<TokensPair> {
    const accessToken = jwt.sign(
      {
        userId: this.userId,
        clientId: this.clientId
      },
      process.env.JWT_SECRET_ACCESS_TOKEN as Secret,
      { expiresIn: '15m', jwtid: this.jti }
    );

    const refreshToken = jwt.sign(
      {
        userId: this.userId,
        clientId: this.clientId
      },
      process.env.JWT_SECRET_REFRESH_TOKEN as Secret,
      { expiresIn: '30d', jwtid: this.jti }
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  public static generateJti(): Promise<string> {
    return new Promise((resolve) => {
      const jti = crypto.randomUUID();

      resolve(jti);
    });
  }
}
