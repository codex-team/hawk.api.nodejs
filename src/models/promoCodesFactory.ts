import { Collection, Db, Filter, ObjectId } from 'mongodb';
import { applyDiscount, ensureActivePromoCode, normalizePromoCode, PromoCode } from '../billing/promoCodes';
import { PromoCodeInput, PromoCodeQuote, PromoPayment, validatePromoPayment } from '../billing/promoCodes/redemptions';
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
    const promoCode = await this.findActivePromoCode({ value: normalizePromoCode(input.promoCode) }, input.tariffPlanId);
    const finalAmount = applyDiscount(promoCode.discount, input.originalAmount);

    await this.redemptions.ensurePromoCodeAvailable(promoCode, input);

    return {
      promoCodeId: promoCode._id,
      originalAmount: input.originalAmount,
      finalAmount,
    };
  }

  /**
   * Check current restrictions using a single code lookup and the signed price.
   *
   * @param payment - verified signed quote and provider callback fields
   */
  public async ensurePaymentAvailable(payment: PromoPayment): Promise<void> {
    validatePromoPayment(payment);

    const promoCode = await this.findActivePromoCode({ _id: new ObjectId(payment.promoCodeId) }, new ObjectId(payment.tariffPlanId));

    await this.redemptions.ensurePromoCodeAvailable(promoCode, {
      userId: new ObjectId(payment.userId),
      workspaceId: new ObjectId(payment.workspaceId),
    }, payment.transactionId);
  }

  /**
   * Read legacy percentage documents without changing stored data.
   *
   * @param query - indexed value or identifier lookup
   * @param tariffPlanId - selected plan
   */
  private async findActivePromoCode(query: Filter<PromoCode>, tariffPlanId: ObjectId): Promise<PromoCode> {
    const promoCode = await this.collection.findOne(query);

    ensureActivePromoCode(promoCode, tariffPlanId);

    /*
     * shortcut: support discountPercent until existing documents have been migrated to discount.
     */
    const legacy = promoCode as PromoCode & { discountPercent?: number };

    if (promoCode.discount === undefined && typeof legacy.discountPercent === 'number') {
      return {
        ...promoCode,
        discount: {
          type: 'percent',
          value: legacy.discountPercent,
        },
      };
    }

    return promoCode;
  }
}
