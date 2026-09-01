import jwt, { Secret } from 'jsonwebtoken';
import {
  PaymentChecksumData,
  PaymentChecksumInput
} from '../billing/types/paymentData';

/**
 * Helper class for working with checksums
 */
class ChecksumService {
  /**
   * Generates checksum for processing billing requests
   *
   * @param data - data for processing billing request
   */
  public async generateChecksum(data: PaymentChecksumInput): Promise<string> {
    return jwt.sign(
      {
        ...data,
        isCardLinkOperation: Boolean(data.isCardLinkOperation),
        shouldSaveCard: Boolean(data.shouldSaveCard),
      },
      process.env.JWT_SECRET_BILLING_CHECKSUM as Secret,
      { expiresIn: '30m' }
    );
  }

  /**
   * Parses checksum from request data and returns data from it
   *
   * @param checksum - checksum to parse
   */
  public parseAndVerifyChecksum(checksum: string): PaymentChecksumData {
    const payload = jwt.verify(checksum, process.env.JWT_SECRET_BILLING_CHECKSUM as Secret) as PaymentChecksumData;

    return {
      workspaceId: payload.workspaceId,
      userId: payload.userId,
      tariffPlanId: payload.tariffPlanId,
      shouldSaveCard: payload.shouldSaveCard,
      isCardLinkOperation: payload.isCardLinkOperation,
      chargeAmount: payload.chargeAmount,
      nextPaymentDate: payload.nextPaymentDate,
      promoCodeId: payload.promoCodeId,
      promoUtm: payload.promoUtm,
    };
  }
}

const checksumService = new ChecksumService();

export default checksumService;
