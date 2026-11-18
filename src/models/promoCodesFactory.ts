import { Collection, Db, Filter, ObjectId } from 'mongodb';
import { applyDiscount, ensureActivePromoCode, normalizePromoCode, PromoCode } from '../billing/promoCodes';
import { PromoCodeInput, PromoCodeQuote, PromoPayment, validatePromoPayment } from '../billing/promoCodes/validation';
import PromoCodeRedemptionsFactory from './promoCodeRedemptionsFactory';

/**
 * Promo code lookup and payment availability checks.
 */
export default class PromoCodesFactory {
  private readonly collection: Collection<PromoCode>;
  private readonly redemptions: PromoCodeRedemptionsFactory;

  /**
   * Create a promo code factory.
   *
   * @param dbConnection - accounts database
   * @param redemptions - successful usage factory shared with the request context
   */
  constructor(dbConnection: Db, redemptions: PromoCodeRedemptionsFactory) {
    this.collection = dbConnection.collection('promoCodes');
    this.redemptions = redemptions;
  }

  /**
   * Calculate a quote without reserving or recording usage.
   *
   * @param input - requested payment with server-resolved identity and price
   */
  public async calculatePromoQuote(input: PromoCodeInput): Promise<PromoCodeQuote> {
    const promoCode = await this.findActivePromoCode({ code: normalizePromoCode(input.promoCode) }, input.tariffPlanId);
    const finalAmount = applyDiscount(promoCode.discount, input.originalAmount);

    await this.redemptions.ensurePromoCodeAvailable(promoCode, input);

    return {
      promoCodeId: promoCode._id,
      originalAmount: input.originalAmount,
      finalAmount,
    };
  }

  /**
   * Re-check in /check that the paid amount matches the signed price and the code can still be used for this plan, payer and workspace.
   *
   * @param payment - verified signed quote and provider callback fields
   */
  public async ensurePromoCodeStillValid(payment: PromoPayment): Promise<void> {
    validatePromoPayment(payment);

    const promoCode = await this.findActivePromoCode({ _id: new ObjectId(payment.promoCodeId) }, new ObjectId(payment.tariffPlanId));

    await this.redemptions.ensurePromoCodeAvailable(promoCode, {
      userId: new ObjectId(payment.userId),
      workspaceId: new ObjectId(payment.workspaceId),
    }, payment.transactionId);
  }

  /**
   * Find a promo code that can be applied to the selected plan, or throw.
   *
   * @param query - indexed code or identifier lookup
   * @param tariffPlanId - selected plan
   */
  private async findActivePromoCode(query: Filter<PromoCode>, tariffPlanId: ObjectId): Promise<PromoCode> {
    const promoCode = await this.collection.findOne(query);

    ensureActivePromoCode(promoCode, tariffPlanId);

    return promoCode;
  }
}
