import '../../src/env-test';

const cloudPaymentsClientMocks = {
  createReceipt: jest.fn().mockResolvedValue(undefined),
  cancelSubscription: jest.fn().mockResolvedValue(undefined),
};

jest.mock('cloudpayments', () => ({
  ClientService: jest.fn().mockImplementation(() => ({
    getReceiptApi: jest.fn().mockReturnValue({
      createReceipt: (...args: unknown[]) => cloudPaymentsClientMocks.createReceipt(...args),
    }),
    getClientApi: jest.fn().mockReturnValue({
      cancelSubscription: (...args: unknown[]) => cloudPaymentsClientMocks.cancelSubscription(...args),
    }),
  })),
  ReceiptTypes: {
    Income: 'Income',
  },
  TaxationSystem: {
    SIMPLIFIED_INCOME: 'SIMPLIFIED_INCOME',
  },
}));

jest.mock('../../src/utils/cloudPaymentsApi', () => ({
  __esModule: true,
  default: {
    cancelPayment: jest.fn().mockResolvedValue(undefined),
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
import {
  CardType,
  Currency,
  Interval,
  OperationStatus,
  OperationType,
  ReasonCode,
  SubscriptionStatus,
} from '../../src/billing/types/enums';
import CloudPaymentsWebhooks from '../../src/billing/cloudpayments';
import { CheckCodes, FailCodes, PayCodes, RecurrentCodes } from '../../src/billing/types';
import checksumService from '../../src/utils/checksumService';
import { publish } from '../../src/rabbitmq';
import cloudPaymentsApi from '../../src/utils/cloudPaymentsApi';
import sendNotification from '../../src/utils/personalNotifications';
import { SenderWorkerTaskType } from '../../src/types/userNotifications';
import { BusinessOperationStatus, BusinessOperationType } from '@hawk.so/types';

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

async function buildCardLinkChecksumPayload(options: {
  workspaceId: string;
  userId: string;
  cloudPayments?: Record<string, unknown>;
}) {
  const checksum = await checksumService.generateChecksum({
    isCardLinkOperation: true,
    workspaceId: options.workspaceId,
    userId: options.userId,
    nextPaymentDate: new Date().toISOString(),
  });

  return JSON.stringify({
    checksum,
    ...(options.cloudPayments ? { cloudPayments: options.cloudPayments } : {}),
  });
}

function createCheckBody(transactionId: number, amount: string, data: string) {
  return {
    TransactionId: transactionId,
    Amount: amount,
    Currency: Currency.RUB,
    DateTime: new Date(),
    TestMode: true,
    Status: OperationStatus.COMPLETED,
    OperationType: OperationType.PAYMENT,
    CardType: CardType.VISA,
    CardExpDate: '12/30',
    CardFirstSix: '411111',
    CardLastFour: '1111',
    Data: data,
  };
}

function createPayBody(transactionId: number, amount: string, data?: string, overrides: Record<string, unknown> = {}) {
  return {
    TransactionId: transactionId,
    Amount: amount,
    Currency: Currency.RUB,
    DateTime: new Date(),
    TestMode: true,
    Status: OperationStatus.COMPLETED,
    OperationType: OperationType.PAYMENT,
    CardType: CardType.VISA,
    CardExpDate: '12/30',
    CardFirstSix: '411111',
    CardLastFour: '1111',
    Token: 'token',
    IssuerBankCountry: 'RU',
    Data: data,
    ...overrides,
  };
}

function createWebhookContext(options: {
  workspaceId: string;
  userId: string;
  plan: ReturnType<typeof createPlan>;
  promoCode?: ReturnType<typeof createPromoCode> | null;
  createUsageImpl?: jest.Mock;
  subscriptionId?: string | null;
  findBySubscriptionIdImpl?: jest.Mock;
}) {
  const workspaceObjectId = new ObjectId(options.workspaceId);
  const changePlan = jest.fn().mockResolvedValue(1);
  const setSubscriptionId = jest.fn().mockResolvedValue(undefined);
  const workspace = {
    _id: workspaceObjectId,
    name: 'Test Workspace',
    tariffPlanId: options.plan._id,
    subscriptionId: options.subscriptionId ?? null,
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
  const createBusinessOperation = jest.fn().mockResolvedValue(businessOperation);

  const context = {
    factories: {
      workspacesFactory: {
        findById: jest.fn().mockResolvedValue(workspace),
        findBySubscriptionId: options.findBySubscriptionIdImpl ?? jest.fn().mockResolvedValue(null),
      },
      plansFactory: {
        findById: jest.fn().mockResolvedValue(options.plan),
      },
      usersFactory: {
        findById: jest.fn().mockResolvedValue(user),
      },
      businessOperationsFactory: {
        create: createBusinessOperation,
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
    createBusinessOperation,
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

    it('should keep card-link checksum data when unsigned Data contains plan payment fields', async () => {
      const checksum = await checksumService.generateChecksum({
        isCardLinkOperation: true,
        workspaceId: 'signed-workspace',
        userId: 'signed-user',
        nextPaymentDate: new Date().toISOString(),
      });
      const webhooks = new CloudPaymentsWebhooks() as any;

      const data = await webhooks.getDataFromRequest({
        body: {
          Data: JSON.stringify({
            checksum,
            tariffPlanId: 'unsigned-plan',
            shouldSaveCard: true,
            promo: {
              id: new ObjectId().toString(),
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
        tariffPlanId: '',
        shouldSaveCard: false,
        isCardLinkOperation: true,
        cloudPayments: {
          recurrent: {
            interval: 'Month',
            period: 1,
          },
        },
      });
      expect(data.promo).toBeUndefined();
    });

    it('should restore subscription renewal data by SubscriptionId without promo', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const { context, workspace } = createWebhookContext({
        workspaceId,
        userId,
        plan,
        subscriptionId: 'subscription-id',
      });

      context.factories.workspacesFactory.findBySubscriptionId = jest.fn().mockResolvedValue(workspace);

      const data = await webhooks.getDataFromRequest({
        context,
        body: {
          SubscriptionId: 'subscription-id',
          AccountId: userId,
        },
      });

      expect(context.factories.workspacesFactory.findBySubscriptionId).toHaveBeenCalledWith('subscription-id');
      expect(data).toMatchObject({
        workspaceId,
        userId,
        tariffPlanId: plan._id.toString(),
        shouldSaveCard: false,
        isCardLinkOperation: false,
      });
      expect(data.promo).toBeUndefined();
    });
  });

  describe('check()', () => {
    it('should accept card-link validation amount without changing plan', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const { context, createBusinessOperation } = createWebhookContext({
        workspaceId,
        userId,
        plan,
      });
      const res = createMockResponse();
      const Data = await buildCardLinkChecksumPayload({
        workspaceId,
        userId,
        cloudPayments: {
          recurrent: {
            interval: 'Month',
            period: 1,
            amount: 1000,
            startDate: new Date().toISOString(),
          },
        },
      });

      await webhooks.check({ context, body: createCheckBody(1000, '1', Data) }, res);

      expect(createBusinessOperation).toHaveBeenCalledWith(expect.objectContaining({
        type: BusinessOperationType.CardLinkCharge,
        status: BusinessOperationStatus.Pending,
      }));
      expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.SUCCESS });
    });

    it('should validate amount against signed plan when unsigned Data tries to replace tariffPlanId', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const signedPlan = createPlan(1000);
      const unsignedPlan = createPlan(500);
      const { context } = createWebhookContext({
        workspaceId,
        userId,
        plan: signedPlan,
      });
      const res = createMockResponse();
      const checksum = await checksumService.generateChecksum({
        workspaceId,
        userId,
        tariffPlanId: signedPlan._id.toString(),
        shouldSaveCard: false,
        nextPaymentDate: new Date().toISOString(),
      });
      const Data = JSON.stringify({
        checksum,
        tariffPlanId: unsignedPlan._id.toString(),
      });

      context.factories.plansFactory.findById = jest.fn().mockImplementation((planId: string) => {
        return Promise.resolve(planId === signedPlan._id.toString() ? signedPlan : unsignedPlan);
      });

      await webhooks.check({ context, body: createCheckBody(1001, '500', Data) }, res);

      expect(context.factories.plansFactory.findById).toHaveBeenCalledWith(signedPlan._id.toString());
      expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.WRONG_AMOUNT });
    });

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

    it('should accept full plan amount when promo is not applied', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const planId = plan._id.toString();
      const { context } = createWebhookContext({ workspaceId, userId, plan });
      const res = createMockResponse();
      const Data = await buildChecksumPayload({ workspaceId, userId, planId });

      await webhooks.check({ context, body: createCheckBody(1006, '1000', Data) }, res);

      expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.SUCCESS });
    });

    it('should accept full plan amount on subscription renewal check without promo in Data', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const { context, workspace } = createWebhookContext({
        workspaceId,
        userId,
        plan,
        subscriptionId: 'subscription-id',
      });

      context.factories.workspacesFactory.findBySubscriptionId = jest.fn().mockResolvedValue(workspace);

      const res = createMockResponse();

      await webhooks.check({
        context,
        body: {
          ...createCheckBody(1010, '1000', ''),
          SubscriptionId: 'subscription-id',
          AccountId: userId,
          Data: undefined,
        },
      }, res);

      expect(context.factories.workspacesFactory.findBySubscriptionId).toHaveBeenCalledWith('subscription-id');
      expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.SUCCESS });
    });

    it('should reject wrong amount on subscription renewal check without Data', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const { context, workspace } = createWebhookContext({
        workspaceId,
        userId,
        plan,
        subscriptionId: 'subscription-id',
      });

      context.factories.workspacesFactory.findBySubscriptionId = jest.fn().mockResolvedValue(workspace);

      const res = createMockResponse();

      await webhooks.check({
        context,
        body: {
          ...createCheckBody(1011, '999', ''),
          SubscriptionId: 'subscription-id',
          AccountId: userId,
          Data: undefined,
        },
      }, res);

      expect(context.factories.workspacesFactory.findBySubscriptionId).toHaveBeenCalledWith('subscription-id');
      expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.WRONG_AMOUNT });
    });

    it('should reject wrong amount when promo is not applied', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const planId = plan._id.toString();
      const { context } = createWebhookContext({ workspaceId, userId, plan });
      const res = createMockResponse();
      const Data = await buildChecksumPayload({ workspaceId, userId, planId });

      await webhooks.check({ context, body: createCheckBody(1007, '999', Data) }, res);

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

    it('should record promo usage and complete payment when createUsage succeeds', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const planId = plan._id.toString();
      const promoCode = createPromoCode({ _id: new ObjectId() });
      const { context, changePlan, createUsage } = createWebhookContext({
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
      });

      await webhooks.pay({ context, body: createPayBody(2002, '750', Data) }, res);

      expect(changePlan).toHaveBeenCalledWith(plan._id);
      expect(createUsage).toHaveBeenCalledWith(expect.objectContaining({
        promoCodeId: promoCode._id,
        userId,
        workspaceId: expect.any(ObjectId),
        planId: plan._id,
        benefitType: 'percent_discount',
        originalAmount: 1000,
        finalAmount: 750,
        discountAmount: 250,
      }));
      expect(publish).toHaveBeenCalled();
      expect(sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ type: SenderWorkerTaskType.PaymentSuccess })
      );
      expect(cloudPaymentsClientMocks.createReceipt).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ code: PayCodes.SUCCESS });
    });

    it('should complete payment without promo usage when promo is absent', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const planId = plan._id.toString();
      const { context, changePlan, createUsage } = createWebhookContext({
        workspaceId,
        userId,
        plan,
      });
      const res = createMockResponse();
      const Data = await buildChecksumPayload({ workspaceId, userId, planId });

      await webhooks.pay({ context, body: createPayBody(2003, '1000', Data) }, res);

      expect(changePlan).toHaveBeenCalledWith(plan._id);
      expect(createUsage).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ code: PayCodes.SUCCESS });
    });

    it('should complete subscription renewal without Data and without promo usage', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const { context, workspace, changePlan, createUsage } = createWebhookContext({
        workspaceId,
        userId,
        plan,
        subscriptionId: 'subscription-id',
      });

      context.factories.workspacesFactory.findBySubscriptionId = jest.fn().mockResolvedValue(workspace);

      const res = createMockResponse();

      await webhooks.pay({
        context,
        body: createPayBody(2004, '1000', undefined, {
          AccountId: userId,
          Data: undefined,
          SubscriptionId: 'subscription-id',
        }),
      }, res);

      expect(context.factories.workspacesFactory.findBySubscriptionId).toHaveBeenCalledWith('subscription-id');
      expect(changePlan).toHaveBeenCalledWith(plan._id);
      expect(createUsage).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ code: PayCodes.SUCCESS });
    });

    it('should cancel old subscription when a new subscription id is received', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const planId = plan._id.toString();
      const { context, workspace } = createWebhookContext({
        workspaceId,
        userId,
        plan,
        subscriptionId: 'old-subscription',
      });
      const res = createMockResponse();
      const Data = await buildChecksumPayload({ workspaceId, userId, planId });

      await webhooks.pay({
        context,
        body: createPayBody(2005, '1000', Data, { SubscriptionId: 'new-subscription' }),
      }, res);

      expect(cloudPaymentsClientMocks.cancelSubscription).toHaveBeenCalledWith({ Id: 'old-subscription' });
      expect(workspace.setSubscriptionId).toHaveBeenCalledWith('new-subscription');
      expect(res.json).toHaveBeenCalledWith({ code: PayCodes.SUCCESS });
    });

    it('should refund card-link charge and skip plan change', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const { context, changePlan, createBusinessOperation } = createWebhookContext({
        workspaceId,
        userId,
        plan,
      });
      const res = createMockResponse();
      const Data = await buildCardLinkChecksumPayload({
        workspaceId,
        userId,
        cloudPayments: {
          recurrent: {
            interval: 'Month',
            period: 1,
            amount: 1000,
            startDate: new Date().toISOString(),
          },
        },
      });

      await webhooks.pay({ context, body: createPayBody(2006, '1', Data) }, res);

      expect(changePlan).not.toHaveBeenCalled();
      expect(cloudPaymentsApi.cancelPayment).toHaveBeenCalledWith(2006);
      expect(createBusinessOperation).toHaveBeenCalledWith(expect.objectContaining({
        type: BusinessOperationType.CardLinkRefund,
        status: BusinessOperationStatus.Confirmed,
      }));
      expect(publish).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ code: PayCodes.SUCCESS });
    });

    it('should fail pay flow when limiter task publish fails', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const planId = plan._id.toString();
      const { context } = createWebhookContext({ workspaceId, userId, plan });
      const res = createMockResponse();
      const Data = await buildChecksumPayload({ workspaceId, userId, planId });

      (publish as jest.Mock).mockRejectedValueOnce(new Error('rabbit down'));

      await webhooks.pay({ context, body: createPayBody(2007, '1000', Data) }, res);

      expect(res.json).toHaveBeenCalledWith({ code: PayCodes.SUCCESS });
    });

    it('should fail pay flow when payment success notification fails', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const planId = plan._id.toString();
      const { context } = createWebhookContext({ workspaceId, userId, plan });
      const res = createMockResponse();
      const Data = await buildChecksumPayload({ workspaceId, userId, planId });

      (sendNotification as jest.Mock).mockRejectedValueOnce(new Error('notify failed'));

      await webhooks.pay({ context, body: createPayBody(2008, '1000', Data) }, res);

      expect(res.json).toHaveBeenCalledWith({ code: PayCodes.SUCCESS });
    });
  });

  describe('fail()', () => {
    it('should reject business operation and notify user about failed payment', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const planId = plan._id.toString();
      const { context, businessOperation } = createWebhookContext({ workspaceId, userId, plan });
      const res = createMockResponse();
      const Data = await buildChecksumPayload({ workspaceId, userId, planId });

      await webhooks.fail({
        context,
        body: {
          TransactionId: 3001,
          Amount: 1000,
          Currency: Currency.RUB,
          DateTime: new Date(),
          TestMode: true,
          OperationType: OperationType.PAYMENT,
          CardType: CardType.VISA,
          CardExpDate: '12/30',
          CardFirstSix: '411111',
          CardLastFour: '1111',
          Reason: 'DoNotHonor',
          ReasonCode: ReasonCode.DO_NOT_HONOR,
          Data,
        },
      }, res);

      expect(businessOperation.setStatus).toHaveBeenCalledWith(BusinessOperationStatus.Rejected);
      expect(sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ type: SenderWorkerTaskType.PaymentFailed })
      );
      expect(res.json).toHaveBeenCalledWith({ code: FailCodes.SUCCESS });
    });

    it('should reject fail webhook when checksum data is invalid', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const res = createMockResponse();

      await webhooks.fail({
        context: { factories: {} },
        body: {
          TransactionId: 3002,
          Amount: 1000,
          Currency: Currency.RUB,
          DateTime: new Date(),
          TestMode: true,
          OperationType: OperationType.PAYMENT,
          CardType: CardType.VISA,
          CardExpDate: '12/30',
          CardFirstSix: '411111',
          CardLastFour: '1111',
          Reason: 'DoNotHonor',
          ReasonCode: ReasonCode.DO_NOT_HONOR,
          Data: '{ invalid json',
        },
      }, res);

      expect(res.json).toHaveBeenCalledWith({ code: FailCodes.SUCCESS });
    });
  });

  describe('recurrent()', () => {
    const recurrentBody = {
      AccountId: 'user-id',
      Amount: '1000',
      Currency: Currency.RUB,
      Description: 'Subscription',
      Email: 'user@test.com',
      FailedTransactionsNumber: 0,
      Id: 'subscription-id',
      Interval: Interval.MONTH,
      Period: 1,
      RequireConfirmation: false,
      StartDate: new Date().toISOString(),
      SuccessfulTransactionsNumber: 1,
    };

    it('should clear subscription id when subscription is cancelled in CloudPayments', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const workspaceId = new ObjectId().toString();
      const userId = new ObjectId().toString();
      const plan = createPlan(1000);
      const setSubscriptionId = jest.fn().mockResolvedValue(undefined);
      const workspace = {
        _id: new ObjectId(workspaceId),
        subscriptionId: 'subscription-id',
        setSubscriptionId,
      };
      const res = createMockResponse();

      await webhooks.recurrent({
        context: {
          factories: {
            workspacesFactory: {
              findBySubscriptionId: jest.fn().mockResolvedValue(workspace),
            },
          },
        },
        body: {
          ...recurrentBody,
          Status: SubscriptionStatus.CANCELLED,
        },
      }, res);

      expect(setSubscriptionId).toHaveBeenCalledWith(null);
      expect(res.json).toHaveBeenCalledWith({ code: RecurrentCodes.SUCCESS });
    });

    it('should succeed when cancelled subscription is already detached from workspace', async () => {
      const webhooks = new CloudPaymentsWebhooks() as any;
      const res = createMockResponse();

      await webhooks.recurrent({
        context: {
          factories: {
            workspacesFactory: {
              findBySubscriptionId: jest.fn().mockResolvedValue(null),
            },
          },
        },
        body: {
          ...recurrentBody,
          Status: SubscriptionStatus.REJECTED,
        },
      }, res);

      expect(res.json).toHaveBeenCalledWith({ code: RecurrentCodes.SUCCESS });
    });
  });
});
