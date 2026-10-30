import { Collection, Db, MongoServerError, ObjectId } from 'mongodb';
import { getMaxUses, PromoCode } from '../billing/promoCodes';
import {
  ensurePromoCodeAvailable,
  PromoCodeInput,
  PromoCodeRedemption,
  PromoPayment,
  validatePromoPayment
} from '../billing/promoCodes/redemptions';

/**
 * Successful promo usage, protected by the existing user and workspace unique indexes.
 */
export default class PromoCodeRedemptionsFactory {
  private readonly collection: Collection<PromoCodeRedemption>;

  /**
   * Create a successful usage factory.
   *
   * @param dbConnection - accounts database
   */
  constructor(dbConnection: Db) {
    this.collection = dbConnection.collection('promoCodeRedemptions');
  }

  /**
   * Read successful usage without fetching the code again or reserving capacity.
   *
   * @param promoCode - already fetched code
   * @param identity - payer and paid workspace
   * @param transactionId - provider transaction on callback retries
   */
  public async ensurePromoCodeAvailable(
    promoCode: PromoCode,
    identity: Pick<PromoCodeInput, 'userId' | 'workspaceId'>,
    transactionId?: string
  ): Promise<void> {
    const existing = await this.collection.findOne({
      promoCodeId: promoCode._id,
      $or: [ { userId: identity.userId }, { workspaceId: identity.workspaceId } ],
    });
    const successfulUses = !existing && getMaxUses(promoCode.maxUses) !== undefined
      ? await this.collection.countDocuments({ promoCodeId: promoCode._id })
      : 0;

    ensurePromoCodeAvailable(promoCode, identity, existing, successfulUses, transactionId);
  }

  /**
   * Record a successful provider payment; do not reject money already paid on a limit race.
   *
   * @param payment - verified successful payment
   */
  public async redeem(payment: PromoPayment): Promise<void> {
    validatePromoPayment(payment);

    const usage: PromoCodeRedemption = {
      _id: new ObjectId(),
      promoCodeId: new ObjectId(payment.promoCodeId),
      userId: new ObjectId(payment.userId),
      workspaceId: new ObjectId(payment.workspaceId),
      tariffPlanId: new ObjectId(payment.tariffPlanId),
      transactionId: payment.transactionId,
      originalAmount: payment.originalAmount,
      finalAmount: payment.finalAmount,
    };

    try {
      await this.collection.insertOne(usage);
    } catch (error) {
      if (!(error instanceof MongoServerError) || error.code !== 11000) {
        throw error;
      }

      const existing = await this.collection.findOne({
        promoCodeId: usage.promoCodeId,
        $or: [ { userId: usage.userId }, { workspaceId: usage.workspaceId } ],
      });

      if (!existing) {
        throw error;
      }

      if (existing.transactionId !== payment.transactionId) {
        console.warn('Promo code was used by a parallel successful payment', payment.transactionId);
      }
    }
  }
}
