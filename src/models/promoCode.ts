import { Collection, ObjectId } from 'mongodb';
import AbstractModel from './abstractModel';
import {
  PromoCodeBenefit,
  PromoCodeDBScheme
} from '@hawk.so/types';

/**
 * Model representing promo code settings.
 */
export default class PromoCodeModel extends AbstractModel<PromoCodeDBScheme> implements PromoCodeDBScheme {
  /**
   * Promo code id.
   */
  public _id!: ObjectId;

  /**
   * Normalized promo code value.
   */
  public value!: string;

  /**
   * Benefit granted by this promo code.
   */
  public benefit!: PromoCodeBenefit;

  /**
   * Maximum successful usages count.
   */
  public limit?: number;

  /**
   * Expiration date.
   */
  public expiresAt?: Date;

  /**
   * Creation date.
   */
  public createdAt!: Date;

  /**
   * Last update date.
   */
  public updatedAt!: Date;

  /**
   * Creator id.
   */
  public createdBy!: string;

  /**
   * Model's collection.
   */
  protected collection: Collection<PromoCodeDBScheme>;

  /**
   * Create PromoCode instance.
   *
   * @param promoCodeData - promo code data
   */
  constructor(promoCodeData: PromoCodeDBScheme) {
    super(promoCodeData);
    this.collection = this.dbConnection.collection<PromoCodeDBScheme>('promoCodes');
  }
}
