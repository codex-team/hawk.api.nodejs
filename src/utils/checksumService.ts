
import jwt, { Secret } from 'jsonwebtoken';

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
   * Reservation that authorizes the discounted payment
   */
  promoCodeRedemptionId?: string;
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
   * @param expiresAt - optional reservation deadline; never extends the default lifetime
   */
  public async generateChecksum(data: ChecksumData, expiresAt?: Date): Promise<string> {
    const defaultLifetimeSeconds = 30 * 60;
    let expiresIn = defaultLifetimeSeconds;

    if (expiresAt) {
      const nowSeconds = Math.floor(Date.now() / 1000);

      expiresIn = Math.min(defaultLifetimeSeconds, Math.floor(expiresAt.getTime() / 1000) - nowSeconds);

      if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
        throw new Error('PROMO_CODE_RESERVATION_EXPIRED');
      }
    }

    return jwt.sign(
      data,
      process.env.JWT_SECRET_BILLING_CHECKSUM as Secret,
      { expiresIn }
    );
  }

  /**
   * Parses checksum from request data and returns data from it
   *
   * @param checksum - checksum to parse
   * @param allowExpiredPromo - allow a late callback for an already-bound promo payment
   */
  public parseAndVerifyChecksum(checksum: string, allowExpiredPromo = false): ChecksumData {
    const secret = process.env.JWT_SECRET_BILLING_CHECKSUM as Secret;
    const payload = jwt.verify(checksum, secret, {
      ignoreExpiration: allowExpiredPromo,
    }) as ChecksumData;
    const isPromoPayment = 'promoCodeRedemptionId' in payload && Boolean(payload.promoCodeRedemptionId);

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
        ...(payload.promoCodeRedemptionId
          ? {
            paymentAmount: payload.paymentAmount,
            promoCodeRedemptionId: payload.promoCodeRedemptionId,
          }
          : {}),
      };
    }
  }
}

const checksumService = new ChecksumService();

export default checksumService;
