import jwt, { Secret } from 'jsonwebtoken';
import { UserInputError } from 'apollo-server-express';

export type ChecksumData = PlanPurchaseChecksumData | CardLinkChecksumData;

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
   * Discounted amount for the current payment in rubles
   */
  paymentAmount?: number;
  /**
   * Signed identity and price of the promo payment attempt
   */
  promoPaymentId?: string;
  promoCodeId?: string;
  originalAmount?: number;
  discountPercent?: number;
}

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
   */
  public async generateChecksum(data: ChecksumData): Promise<string> {
    return jwt.sign(data, process.env.JWT_SECRET_BILLING_CHECKSUM as Secret, { expiresIn: '30m' });
  }

  /**
   * Parses checksum from request data and returns data from it
   *
   * @param checksum - checksum to parse
   * @param allowExpiredPromo - allow a late callback for a checked promo payment
   */
  public parseAndVerifyChecksum(checksum: string, allowExpiredPromo = false): ChecksumData {
    const secret = process.env.JWT_SECRET_BILLING_CHECKSUM as Secret;
    const payload = jwt.verify(checksum, secret, {
      ignoreExpiration: allowExpiredPromo,
    }) as ChecksumData;
    const isPromoPayment = 'promoPaymentId' in payload && Boolean(payload.promoPaymentId);

    if ('promoCodeRedemptionId' in payload) {
      throw new UserInputError('PROMO_CODE_INVALID');
    }

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
        ...(payload.promoPaymentId
          ? {
            paymentAmount: payload.paymentAmount,
            promoPaymentId: payload.promoPaymentId,
            promoCodeId: payload.promoCodeId,
            originalAmount: payload.originalAmount,
            discountPercent: payload.discountPercent,
          }
          : {}),
      };
    }
  }
}

const checksumService = new ChecksumService();

export default checksumService;
