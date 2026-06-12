import jwt, { Secret } from 'jsonwebtoken';
import type { Utm } from '@hawk.so/types';

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
   * Applied promo code id
   */
  promoCodeId?: string;
  /**
   * Applied promo code value
   */
  promoCodeValue?: string;
  /**
   * Promo benefit type
   */
  benefitType?: 'grant_plan' | 'percent_discount' | 'amount_discount' | 'fixed_price';
  /**
   * Plan price before promo
   */
  originalAmount?: number;
  /**
   * Final price after promo
   */
  finalAmount?: number;
  /**
   * Actual discount amount
   */
  discountAmount?: number;
  /**
   * UTM parameters captured when promo was applied
   */
  promoUtm?: Utm;
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
    return jwt.sign(
      data,
      process.env.JWT_SECRET_BILLING_CHECKSUM as Secret,
      { expiresIn: '30m' }
    );
  }

  /**
   * Parses checksum from request data and returns data from it
   *
   * @param checksum - checksum to parse
   */
  public parseAndVerifyChecksum(checksum: string): ChecksumData {
    const payload = jwt.verify(checksum, process.env.JWT_SECRET_BILLING_CHECKSUM as Secret) as ChecksumData;

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
        promoCodeId: payload.promoCodeId,
        promoCodeValue: payload.promoCodeValue,
        benefitType: payload.benefitType,
        originalAmount: payload.originalAmount,
        finalAmount: payload.finalAmount,
        discountAmount: payload.discountAmount,
        promoUtm: payload.promoUtm,
      };
    }
  }
}

const checksumService = new ChecksumService();

export default checksumService;
