import '../../src/env-test';

jest.mock('cloudpayments', () => ({
  ClientService: jest.fn().mockImplementation(() => ({
    getReceiptApi: jest.fn().mockReturnValue({}),
    getClientApi: jest.fn().mockReturnValue({}),
  })),
  ReceiptTypes: {
    Income: 'Income',
  },
  TaxationSystem: {
    Common: 'Common',
  },
}));

jest.mock('../../src/mongo', () => ({
  databases: {
    hawk: {
      collection: jest.fn().mockReturnValue({}),
    },
  },
}));

import { ObjectId } from 'mongodb';
import CloudPaymentsWebhooks from '../../src/billing/cloudpayments';
import checksumService from '../../src/utils/checksumService';

process.env.JWT_SECRET_BILLING_CHECKSUM = 'checksum_secret';

describe('CloudPaymentsWebhooks', () => {
  describe('getDataFromRequest()', () => {
    it('should trust checksum fields over unsigned widget Data fields', async () => {
      const promoId = new ObjectId().toString();
      const unsignedPromoId = new ObjectId().toString();
      const checksum = await checksumService.generateChecksum({
        workspaceId: 'signed-workspace',
        userId: 'signed-user',
        tariffPlanId: 'signed-plan',
        shouldSaveCard: false,
        nextPaymentDate: new Date().toISOString(),
        promo: {
          id: promoId,
        },
      });
      const webhooks = new CloudPaymentsWebhooks() as any;

      const data = await webhooks.getDataFromRequest({
        body: {
          Data: JSON.stringify({
            checksum,
            workspaceId: 'unsigned-workspace',
            userId: 'unsigned-user',
            tariffPlanId: 'unsigned-plan',
            shouldSaveCard: true,
            promo: {
              id: unsignedPromoId,
            },
            cloudPayments: {
              recurrent: {
                interval: 'Month',
                period: 1,
              },
            },
          }),
        },
      });

      expect(data).toMatchObject({
        workspaceId: 'signed-workspace',
        userId: 'signed-user',
        tariffPlanId: 'signed-plan',
        shouldSaveCard: false,
        promo: {
          id: promoId,
        },
        cloudPayments: {
          recurrent: {
            interval: 'Month',
            period: 1,
          },
        },
        isCardLinkOperation: false,
      });
    });
  });
});
