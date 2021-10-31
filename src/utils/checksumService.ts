import { PlanProlongationPayload } from '@hawk.so/types';
import jwt, { Secret } from 'jsonwebtoken';

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
   * @param checksum - checksum to parse
   */
  public parseAndVerifyChecksum(checksum: string): PlanProlongationPayload {
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
