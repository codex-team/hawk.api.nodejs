import { randomUUID } from 'node:crypto';
import { Collection, ObjectId, OptionalId } from 'mongodb';
import jwt from 'jsonwebtoken';
import AbstractModel from './abstractModel';

import type { Secret } from 'jsonwebtoken';
import type { OAuthClientDBScheme, TokenPermissions, TokensPair } from '@hawk.so/types';

export default class OAuthClientModel extends AbstractModel<OptionalId<OAuthClientDBScheme>> implements OAuthClientDBScheme {
  /**
   * External client identifier
   */
  public _id!: ObjectId;

  /**
   * Token owner id
   */
  public userId!: string;

  /**
   * User agent id
   */
  public clientId!: string;

  /**
   * Unique JSON Web Token Identifier
   */
  public jti!: string;

  /**
   * What client is allowed to do
   */
  public permissions!: TokenPermissions[];

  /**
   * Label set by user
   */
  public lable!: string;

  /**
   * Last time the client interacted with hawk api
   */
  public lastUsedAt!: Date | null;

  /**
   * Usage count
   */
  public requestCount!: number;

  /**
   * Creation date
   */
  public createdAt!: Date;

  public collection!: Collection<OptionalId<OAuthClientDBScheme>>;

  constructor(oauthClient: OptionalId<OAuthClientDBScheme>) {
    super(oauthClient);
    this.collection = this.dbConnection.collection<OptionalId<OAuthClientDBScheme>>('oauthClients');
  }

  public static generateJti(): Promise<string> {
    return new Promise((resolve) => {
      const jti = randomUUID();

      resolve(jti);
    });
  }

  public async generateTokensPair(): Promise<TokensPair> {
    const accessToken = jwt.sign(
      {
        userId: this.userId,
        clientId: this.clientId,
      },
      process.env.JWT_SECRET_ACCESS_TOKEN as Secret,
      {
        expiresIn: '15m',
        jwtid: this.jti,
      }
    );

    const refreshToken = jwt.sign(
      {
        userId: this.userId,
        clientId: this.clientId,
      },
      process.env.JWT_SECRET_REFRESH_TOKEN as Secret,
      {
        expiresIn: '30d',
        jwtid: this.jti,
      }
    );

    return {
      accessToken,
      refreshToken,
    };
  }
}
