import { PlanProlongationPayload } from 'hawk.types';
import jwt, { Secret } from 'jsonwebtoken';
import { WebhookData } from '../billing/types/request';

/**
 * Helper class for working with checksums
 */
class ChecksumService {
  /**
   * Generates checksum for processing billing requests
   *
   * @param data - data for processing billing request
   */
  public async generateChecksum(data: PlanProlongationPayload): Promise<string> {
    return jwt.sign(
      data,
      process.env.JWT_SECRET_BILLING_CHECKSUM as Secret,
      { expiresIn: '30m' }
    );
  }

  /**
   * Parses checksum from request data and returns data from it
   *
   * @param data - data to parse
   */
  public parseAndVerifyData(data: string | undefined): PlanProlongationPayload {
    const parsedData = JSON.parse(data || '{}') as WebhookData;
    const checksum = parsedData.checksum;

    const payload = jwt.verify(checksum, process.env.JWT_SECRET_BILLING_CHECKSUM as Secret) as PlanProlongationPayload;

    /**
     * Filter unnecessary fields from JWT payload (e.g. "iat")
     */
    const { tariffPlanId, workspaceId, userId, shouldSaveCard } = payload;

    return {
      tariffPlanId,
      workspaceId,
      userId,
      shouldSaveCard,
    };
  }
}

const checksumService = new ChecksumService();

export default checksumService;
