import '../../src/env-test';

jest.mock('cloudpayments', () => ({
  ClientService: jest.fn().mockImplementation(() => ({
    getReceiptApi: jest.fn().mockReturnValue({
      createReceipt: jest.fn().mockResolvedValue(undefined),
    }),
    getClientApi: jest.fn().mockReturnValue({
      cancelSubscription: jest.fn().mockResolvedValue(undefined),
    }),
  })),
  ReceiptTypes: {
    Income: 'Income',
  },
  TaxationSystem: {
    SIMPLIFIED_INCOME: 'SIMPLIFIED_INCOME',
  },
}));

jest.mock('../../src/mongo', () => ({
  databases: {
    hawk: {
      collection: jest.fn().mockReturnValue({}),
    },
  },
}));

jest.mock('../../src/rabbitmq', () => ({
  publish: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/telegram', () => ({
  sendMessage: jest.fn().mockResolvedValue(undefined),
  TelegramBotURLs: { Money: 'money-url' },
}));

jest.mock('../../src/utils/personalNotifications', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@hawk.so/nodejs', () => ({
  __esModule: true,
  default: {
    send: jest.fn(),
  },
}));

import { ObjectId } from 'mongodb';
import { CardType, Currency, OperationStatus, OperationType } from '../../src/billing/types/enums';
import CloudPaymentsWebhooks from '../../src/billing/cloudpayments';
import { CheckCodes, PayCodes } from '../../src/billing/types';
import checksumService from '../../src/utils/checksumService';
import { publish } from '../../src/rabbitmq';

process.env.JWT_SECRET_BILLING_CHECKSUM = 'checksum_secret';
process.env.CLOUDPAYMENTS_PUBLIC_ID = 'public';
process.env.CLOUDPAYMENTS_SECRET = 'secret';
process.env.LEGAL_ENTITY_INN = '1234567890';

function createPromoCode(overrides: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(),
    value: 'SAVE25',
    benefit: {
      type: 'percent_discount',
      percent: 25,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: new ObjectId().toString(),
    ...overrides,
  };
}

function createPlan(monthlyCharge = 1000) {
  return {
    _id: new ObjectId(),
    name: 'Basic',
    monthlyCharge,
    monthlyChargeCurrency: 'RUB',
    eventsLimit: 1000,
    isDefault: false,
    isHidden: false,
  };
}

async function buildChecksumPayload(options: {
  workspaceId: string;
  userId: string;
  planId: string;
  promoId?: string;
  cloudPayments?: Record<string, unknown>;
}) {
  const checksum = await checksumService.generateChecksum({
    workspaceId: options.workspaceId,
    userId: options.userId,
    tariffPlanId: options.planId,
    shouldSaveCard: false,
    nextPaymentDate: new Date().toISOString(),
    ...(options.promoId ? { promo: { id: options.promoId } } : {}),
  });

  return JSON.stringify({
    checksum,
    ...(options.cloudPayments ? { cloudPayments: options.cloudPayments } : {}),
  });
}

function createWebhookContext(options: {
  workspaceId: string;
  userId: string;
  plan: ReturnType<typeof createPlan>;
  promoCode?: ReturnType<typeof createPromoCode> | null;
  createUsageImpl?: jest.Mock;
}) {
  const workspaceObjectId = new ObjectId(options.workspaceId);
  const changePlan = jest.fn().mockResolvedValue(1);
  const setSubscriptionId = jest.fn().mockResolvedValue(undefined);
  const workspace = {
    _id: workspaceObjectId,
    name: 'Test Workspace',
    tariffPlanId: options.plan._id,
    subscriptionId: null,
    getMemberInfo: jest.fn().mockResolvedValue({
      _id: new ObjectId(options.userId),
      userId: new ObjectId(options.userId),
      isAdmin: true,
    }),
    changePlan,
    setSubscriptionId,
  };

  const businessOperation = {
    setStatus: jest.fn().mockResolvedValue(undefined),
  };

  const user = {
    _id: new ObjectId(options.userId),
    email: 'user@test.com',
    saveNewBankCard: jest.fn().mockResolvedValue(undefined),
  };

  const createUsage = options.createUsageImpl ?? jest.fn().mockResolvedValue({ _id: new ObjectId() });

  const context = {
    factories: {
      workspacesFactory: {
        findById: jest.fn().mockResolvedValue(workspace),
      },
      plansFactory: {
        findById: jest.fn().mockResolvedValue(options.plan),
      },
      usersFactory: {
        findById: jest.fn().mockResolvedValue(user),
      },
      businessOperationsFactory: {
        create: jest.fn().mockResolvedValue(businessOperation),
        getBusinessOperationByTransactionId: jest.fn().mockResolvedValue(businessOperation),
      },
      promoCodesFactory: {
        findOne: jest.fn().mockResolvedValue(options.promoCode ?? null),
      },
      promoCodeUsagesFactory: {
        countByPromoCodeId: jest.fn().mockResolvedValue(0),
        findByPromoCodeAndUser: jest.fn().mockResolvedValue(null),
        findByPromoCodeAndWorkspace: jest.fn().mockResolvedValue(null),
        create: createUsage,
      },
    },
  };

  return {
    context,
    workspace,
    changePlan,
    createUsage,
    businessOperation,
    user,
  };
}

function createMockResponse() {
  return {
    json: jest.fn(),
  };
}

describe('CloudPaymentsWebhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  describe('check()', () => {
    it('should reject wrong amount when promo id is in checksum', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const planId = plan._id.toString();
      const promoCode = createPromoCode({ _id: new ObjectId() });
      const { context } = createWebhookContext({
        workspaceId,
        userId,
        plan,
        promoCode,
      });
      const res = createMockResponse();
      const Data = await buildChecksumPayload({
        workspaceId,
        userId,
        planId,
        promoId: promoCode._id.toString(),
        cloudPayments: {
          recurrent: {
            interval: 'Month',
            period: 1,
            amount: 1000,
          },
        },
      });

      await webhooks.check({
        context,
        body: {
          TransactionId: 1001,
          Amount: '1000',
          Currency: Currency.RUB,
          DateTime: new Date(),
          TestMode: true,
          Status: OperationStatus.COMPLETED,
          OperationType: OperationType.PAYMENT,
          CardType: CardType.VISA,
          CardExpDate: '12/30',
          CardFirstSix: '411111',
          CardLastFour: '1111',
          Data,
        },
      }, res);

      expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.WRONG_AMOUNT });
    });

    it('should accept discounted amount and full recurrent amount when promo is applied', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const planId = plan._id.toString();
      const promoCode = createPromoCode({ _id: new ObjectId() });
      const { context } = createWebhookContext({
        workspaceId,
        userId,
        plan,
        promoCode,
      });
      const res = createMockResponse();
      const Data = await buildChecksumPayload({
        workspaceId,
        userId,
        planId,
        promoId: promoCode._id.toString(),
        cloudPayments: {
          recurrent: {
            interval: 'Month',
            period: 1,
            amount: 1000,
            startDate: new Date().toISOString(),
          },
        },
      });

      await webhooks.check({
        context,
        body: {
          TransactionId: 1002,
          Amount: '750',
          Currency: Currency.RUB,
          DateTime: new Date(),
          TestMode: true,
          Status: OperationStatus.COMPLETED,
          OperationType: OperationType.PAYMENT,
          CardType: CardType.VISA,
          CardExpDate: '12/30',
          CardFirstSix: '411111',
          CardLastFour: '1111',
          Data,
        },
      }, res);

      expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.SUCCESS });
    });

    it('should reject discounted recurrent amount when promo is applied', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const planId = plan._id.toString();
      const promoCode = createPromoCode({ _id: new ObjectId() });
      const { context } = createWebhookContext({
        workspaceId,
        userId,
        plan,
        promoCode,
      });
      const res = createMockResponse();
      const Data = await buildChecksumPayload({
        workspaceId,
        userId,
        planId,
        promoId: promoCode._id.toString(),
        cloudPayments: {
          recurrent: {
            interval: 'Month',
            period: 1,
            amount: 750,
          },
        },
      });

      await webhooks.check({
        context,
        body: {
          TransactionId: 1003,
          Amount: '750',
          Currency: Currency.RUB,
          DateTime: new Date(),
          TestMode: true,
          Status: OperationStatus.COMPLETED,
          OperationType: OperationType.PAYMENT,
          CardType: CardType.VISA,
          CardExpDate: '12/30',
          CardFirstSix: '411111',
          CardLastFour: '1111',
          Data,
        },
      }, res);

      expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.WRONG_AMOUNT });
    });

    it('should allow 1 RUB deferred charge only without promo', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const planId = plan._id.toString();
      const { context } = createWebhookContext({
        workspaceId,
        userId,
        plan,
      });
      const res = createMockResponse();
      const Data = await buildChecksumPayload({
        workspaceId,
        userId,
        planId,
        cloudPayments: {
          recurrent: {
            interval: 'Month',
            period: 1,
            amount: 1000,
            startDate: new Date().toISOString(),
          },
        },
      });

      await webhooks.check({
        context,
        body: {
          TransactionId: 1004,
          Amount: '1',
          Currency: Currency.RUB,
          DateTime: new Date(),
          TestMode: true,
          Status: OperationStatus.COMPLETED,
          OperationType: OperationType.PAYMENT,
          CardType: CardType.VISA,
          CardExpDate: '12/30',
          CardFirstSix: '411111',
          CardLastFour: '1111',
          Data,
        },
      }, res);

      expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.SUCCESS });
    });

    it('should not allow 1 RUB deferred charge when promo is applied', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const planId = plan._id.toString();
      const promoCode = createPromoCode({ _id: new ObjectId() });
      const { context } = createWebhookContext({
        workspaceId,
        userId,
        plan,
        promoCode,
      });
      const res = createMockResponse();
      const Data = await buildChecksumPayload({
        workspaceId,
        userId,
        planId,
        promoId: promoCode._id.toString(),
        cloudPayments: {
          recurrent: {
            interval: 'Month',
            period: 1,
            amount: 1000,
            startDate: new Date().toISOString(),
          },
        },
      });

      await webhooks.check({
        context,
        body: {
          TransactionId: 1005,
          Amount: '1',
          Currency: Currency.RUB,
          DateTime: new Date(),
          TestMode: true,
          Status: OperationStatus.COMPLETED,
          OperationType: OperationType.PAYMENT,
          CardType: CardType.VISA,
          CardExpDate: '12/30',
          CardFirstSix: '411111',
          CardLastFour: '1111',
          Data,
        },
      }, res);

      expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.WRONG_AMOUNT });
    });
  });

  describe('pay()', () => {
    it('should complete pay flow when createUsage fails after changePlan', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const planId = plan._id.toString();
      const promoCode = createPromoCode({ _id: new ObjectId() });
      const createUsage = jest.fn().mockRejectedValue(new Error('usage failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const { context, changePlan } = createWebhookContext({
        workspaceId,
        userId,
        plan,
        promoCode,
        createUsageImpl: createUsage,
      });
      const res = createMockResponse();
      const Data = await buildChecksumPayload({
        workspaceId,
        userId,
        planId,
        promoId: promoCode._id.toString(),
      });

      await webhooks.pay({
        context,
        body: {
          TransactionId: 2001,
          Amount: '750',
          Currency: Currency.RUB,
          DateTime: new Date(),
          TestMode: true,
          Status: OperationStatus.COMPLETED,
          OperationType: OperationType.PAYMENT,
          CardType: CardType.VISA,
          CardExpDate: '12/30',
          CardFirstSix: '411111',
          CardLastFour: '1111',
          IssuerBankCountry: 'US',
          Data,
        },
      }, res);

      expect(changePlan).toHaveBeenCalledWith(plan._id);
      expect(createUsage).toHaveBeenCalled();
      expect(publish).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ code: PayCodes.SUCCESS });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Billing / Pay] Failed to record promo usage after plan change',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
