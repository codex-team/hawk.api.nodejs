import { Collection, ObjectId } from 'mongodb';
import AbstractModel from './abstractModel';
import {
  PromoCodeBenefitType,
  PromoCodeUsageDBScheme
} from '@hawk.so/types';

/**
 * Model representing successful promo code application.
 */
export default class PromoCodeUsageModel extends AbstractModel<PromoCodeUsageDBScheme> implements PromoCodeUsageDBScheme {
  /**
   * Promo code usage id.
   */
  public _id!: ObjectId;

  /**
   * Applied promo code id.
   */
  public promoCodeId!: ObjectId;

  /**
   * User who applied promo code.
   */
  public userId!: string;

  /**
   * Workspace where promo code was applied.
   */
  public workspaceId!: ObjectId;

  /**
   * Plan to which promo was applied.
   */
  public planId?: ObjectId;

  /**
   * Benefit type at application time.
   */
  public benefitType!: PromoCodeBenefitType;

  /**
   * Price before promo.
   */
  public originalAmount?: number;

  /**
   * Price after promo.
   */
  public finalAmount?: number;

  /**
   * Actual discount amount.
   */
  public discountAmount?: number;

  /**
   * UTM parameters captured on apply.
   */
  public utm?: PromoCodeUsageDBScheme['utm'];

  /**
   * Application date.
   */
  public appliedAt!: Date;

  /**
   * Model's collection.
   */
  protected collection: Collection<PromoCodeUsageDBScheme>;

  /**
   * Create PromoCodeUsage instance.
   *
   * @param usageData - usage data
   */
  constructor(usageData: PromoCodeUsageDBScheme) {
    super(usageData);
    this.collection = this.dbConnection.collection<PromoCodeUsageDBScheme>('promoCodeUsages');
  }
}
