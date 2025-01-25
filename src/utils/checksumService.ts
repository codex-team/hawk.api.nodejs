import { PlanProlongationPayload } from '@hawk.so/types';
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
      };
    } else {
      return {
        workspaceId: payload.workspaceId,
        userId: payload.userId,
        tariffPlanId: payload.tariffPlanId,
        shouldSaveCard: payload.shouldSaveCard,
      };
    }
  }
}

const checksumService = new ChecksumService();

export default checksumService;
