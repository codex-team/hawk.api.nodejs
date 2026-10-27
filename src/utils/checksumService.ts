import jwt, { Secret } from 'jsonwebtoken';
import type { PromoPaymentData } from '../billing/types/paymentData';

/**
 * Signed identity for a plan purchase or a card-linking payment.
 */
export type ChecksumData = PlanPurchaseChecksumData | CardLinkChecksumData;

/**
 * Plan purchase data with an optional signed promo price snapshot.
 */
interface PlanPurchaseChecksumData {
  /**
   * Workspace Identifier
   */
  workspaceId: string;
  /**
   * Id of the user making the payment
   */
  userId: string;
  /**
   * Workspace current plan id or plan id to change
   */
  tariffPlanId: string;
  /**
   * If true, we will save user card
   */
  shouldSaveCard: boolean;
  /**
   * Next payment date
   */
  nextPaymentDate: string;
  /**
   * Price snapshot present only for promo payments.
   */
  promo?: PromoPaymentData;
}

/**
 * Signed workspace and payer identity for validating a recurring-payment card.
 */
interface CardLinkChecksumData {
  /**
   * Workspace Identifier
   */
  workspaceId: string;
  /**
   * Id of the user making the payment
   */
  userId: string;
  /**
   * True if this is card linking operation – charging minimal amount of money to validate card info
   */
  isCardLinkOperation: boolean;
  /**
   * Next payment date
   */
  nextPaymentDate: string;
}

/**
 * Helper class for working with checksums
 */
class ChecksumService {
  /**
   * Generates checksum for processing billing requests
   *
   * @param data - data for processing billing request
   * @returns signed payment token valid for thirty minutes
   */
  public async generateChecksum(data: ChecksumData): Promise<string> {
    return jwt.sign(data, process.env.JWT_SECRET_BILLING_CHECKSUM as Secret, { expiresIn: '30m' });
  }

  /**
   * Parses checksum from request data and returns data from it
   *
   * @param checksum - checksum to parse
   * @param allowExpiredPromo - allow a late callback for a checked promo payment
   * @returns verified payment identity without unsigned callback fields
   */
  public parseAndVerifyChecksum(checksum: string, allowExpiredPromo = false): ChecksumData {
    const secret = process.env.JWT_SECRET_BILLING_CHECKSUM as Secret;
    const payload = jwt.verify(checksum, secret, {
      ignoreExpiration: allowExpiredPromo,
    }) as ChecksumData;
    const isPromoPayment = 'promo' in payload && Boolean(payload.promo);

    if (allowExpiredPromo && !isPromoPayment) {
      jwt.verify(checksum, secret);
    }

    if ('isCardLinkOperation' in payload) {
      return {
        workspaceId: payload.workspaceId,
        userId: payload.userId,
        isCardLinkOperation: payload.isCardLinkOperation,
        nextPaymentDate: payload.nextPaymentDate,
      };
    } else {
      return {
        workspaceId: payload.workspaceId,
        userId: payload.userId,
        tariffPlanId: payload.tariffPlanId,
        shouldSaveCard: payload.shouldSaveCard,
        nextPaymentDate: payload.nextPaymentDate,
        ...(payload.promo ? { promo: payload.promo } : {}),
      };
    }
  }
}

const checksumService = new ChecksumService();

export default checksumService;
