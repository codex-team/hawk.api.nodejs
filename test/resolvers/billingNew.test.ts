import '../../src/env-test';

jest.mock('../../src/rabbitmq', () => ({
  publish: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/telegram', () => ({
  sendMessage: jest.fn().mockResolvedValue(undefined),
  TelegramBotURLs: { Money: 'money-url' },
}));

jest.mock('../../src/utils/cloudPaymentsApi', () => ({
  __esModule: true,
  default: {
    payByToken: jest.fn(),
  },
}));

import { ObjectId } from 'mongodb';
import { PlanDBScheme, WorkspaceDBScheme } from '@hawk.so/types';
import { UserInputError } from 'apollo-server-express';
import billingNewResolver from '../../src/resolvers/billingNew';
import { ResolverContextWithUser } from '../../src/types/graphql';
import checksumService from '../../src/utils/checksumService';
import { PromoCodeErrorCode } from '../../src/services/promoCodeService';
import cloudPaymentsApi from '../../src/utils/cloudPaymentsApi';

// Set environment variables for test
process.env.JWT_SECRET_BILLING_CHECKSUM = 'checksum_secret';
process.env.JWT_SECRET_ACCESS_TOKEN = 'belarus';
process.env.JWT_SECRET_REFRESH_TOKEN = 'abacaba';
process.env.JWT_SECRET_PROJECT_TOKEN = 'qwerty';

/**
 * Creates test data and mocks for composePayment tests
 */
function createComposePaymentTestSetup(options: {
  isTariffPlanExpired?: boolean;
  isBlocked?: boolean;
  lastChargeDate?: Date;
  planMonthlyCharge?: number;
  planCurrency?: string;
}) {
  const {
    isTariffPlanExpired = false,
    isBlocked = false,
    lastChargeDate = new Date(),
    planMonthlyCharge = 1000,
    planCurrency = 'RUB'
  } = options;

  const userId = new ObjectId().toString();
  const workspaceId = new ObjectId().toString();
  const planId = new ObjectId().toString();

  const plan: PlanDBScheme = {
    _id: new ObjectId(planId),
    name: 'Test Plan',
    monthlyCharge: planMonthlyCharge,
    monthlyChargeCurrency: planCurrency,
    eventsLimit: 1000,
    isDefault: false,
    isHidden: false,
  };

  const workspace: WorkspaceDBScheme = {
    _id: new ObjectId(workspaceId),
    name: 'Test Workspace',
    accountId: 'test-account-id',
    balance: 0,
    billingPeriodEventsCount: 0,
    isBlocked,
    lastChargeDate,
    tariffPlanId: new ObjectId(planId),
    inviteHash: 'test-invite-hash',
    subscriptionId: undefined,
  };

  // Mock workspaces factory
  const mockWorkspacesFactory = {
    findById: jest.fn().mockResolvedValue({
      ...workspace,
      getMemberInfo: jest.fn().mockResolvedValue({ isAdmin: true }),
      isTariffPlanExpired: jest.fn().mockReturnValue(isTariffPlanExpired),
      isBlocked,
    }),
  };

  // Mock plans factory
  const mockPlansFactory = {
    findById: jest.fn().mockResolvedValue(plan),
  };

  const mockContext: ResolverContextWithUser = {
    user: {
      id: userId,
      accessTokenExpired: false,
    },
    factories: {
      workspacesFactory: mockWorkspacesFactory as any,
      plansFactory: mockPlansFactory as any,
      usersFactory: {} as any,
      projectsFactory: {} as any,
      businessOperationsFactory: {} as any,
      releasesFactory: {} as any,
      promoCodesFactory: {} as any,
      promoCodeUsagesFactory: {} as any,
    },
  };

  return {
    userId,
    workspaceId,
    planId,
    plan,
    workspace,
    mockContext,
    mockWorkspacesFactory,
    mockPlansFactory,
  };
}

/**
 * Attaches promo code factories to resolver context.
 */
function withPromoFactories(
  context: ResolverContextWithUser,
  promoCode: Record<string, unknown> | null,
  options: {
    totalUses?: number;
    userUsage?: unknown;
    workspaceUsage?: unknown;
  } = {}
): void {
  context.factories.promoCodesFactory = {
    findByValue: jest.fn().mockResolvedValue(promoCode),
    findOne: jest.fn().mockResolvedValue(promoCode),
  } as any;
  context.factories.promoCodeUsagesFactory = {
    countByPromoCodeId: jest.fn().mockResolvedValue(options.totalUses ?? 0),
    findByPromoCodeAndUser: jest.fn().mockResolvedValue(options.userUsage ?? null),
    findByPromoCodeAndWorkspace: jest.fn().mockResolvedValue(options.workspaceUsage ?? null),
    create: jest.fn().mockResolvedValue({}),
  } as any;
}

/**
 * Creates test data and mocks for verifyPromoCode tests.
 */
function createVerifyPromoCodeTestSetup(options: {
  promoCode: Record<string, unknown> | null;
  grantPlan?: PlanDBScheme;
}): {
  userId: string;
  workspaceId: string;
  mockContext: ResolverContextWithUser;
  workspaceMock: Record<string, unknown>;
} {
  const userId = new ObjectId().toString();
  const workspaceId = new ObjectId().toString();
  const planId = new ObjectId().toString();

  const workspaceMock = {
    _id: new ObjectId(workspaceId),
    name: 'Test Workspace',
    tariffPlanId: new ObjectId(planId),
    getMemberInfo: jest.fn().mockResolvedValue({ isAdmin: true }),
    updatePlanHistory: jest.fn().mockResolvedValue(true),
    updateLastChargeDate: jest.fn().mockResolvedValue(true),
    changePlan: jest.fn().mockResolvedValue(1),
  };

  const defaultPlan: PlanDBScheme = {
    _id: new ObjectId(planId),
    name: 'Basic',
    monthlyCharge: 1000,
    monthlyChargeCurrency: 'RUB',
    eventsLimit: 1000,
    isDefault: false,
    isHidden: false,
  };

  const grantPlan = options.grantPlan || defaultPlan;

  const mockContext: ResolverContextWithUser = {
    user: {
      id: userId,
      accessTokenExpired: false,
    },
    factories: {
      workspacesFactory: {
        findById: jest.fn().mockResolvedValue(workspaceMock),
      } as any,
      plansFactory: {
        findAll: jest.fn().mockResolvedValue([defaultPlan]),
        findById: jest.fn().mockResolvedValue(grantPlan),
      } as any,
      usersFactory: {} as any,
      projectsFactory: {} as any,
      businessOperationsFactory: {} as any,
      releasesFactory: {} as any,
      promoCodesFactory: {} as any,
      promoCodeUsagesFactory: {} as any,
    },
  };

  withPromoFactories(mockContext, options.promoCode);

  return {
    userId,
    workspaceId,
    mockContext,
    workspaceMock,
  };
}

describe('GraphQLBillingNew', () => {
  describe('composePayment', () => {
    it('should return isCardLinkOperation = false in case of expired tariff plan', async () => {
      // Create 2 months ago date
      const expiredDate = new Date();
      expiredDate.setMonth(expiredDate.getMonth() - 2);

      const { mockContext, planId, workspaceId } = createComposePaymentTestSetup({
        isTariffPlanExpired: true,
        isBlocked: false,
        lastChargeDate: expiredDate,
      });

      // Call composePayment resolver
      const result = await billingNewResolver.Query.composePayment(
        undefined,
        {
          input: {
            workspaceId,
            tariffPlanId: planId,
            shouldSaveCard: false,
          },
        },
        mockContext
      );

      expect(result.isCardLinkOperation).toBe(false);

      const checksumData = checksumService.parseAndVerifyChecksum(result.checksum);

      if ('tariffPlanId' in checksumData) {
        expect(checksumData.promo).toBeUndefined();
      }

      // Check that nextPaymentDate is one month from now
      const oneMonthFromNow = new Date();

      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

      const oneMonthFromNowStr = oneMonthFromNow.toISOString().split('T')[0];
      const nextPaymentDateStr = result.nextPaymentDate.toISOString().split('T')[0];

      expect(nextPaymentDateStr).toBe(oneMonthFromNowStr);
    });

    it('should return isCardLinkOperation = true in case of active tariff plan', async () => {
      // Create 2 days ago date
      const lastChargeDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      const { mockContext, planId, workspaceId, workspace } = createComposePaymentTestSetup({
        isTariffPlanExpired: false,
        isBlocked: false,
        lastChargeDate,
      });

      const result = await billingNewResolver.Query.composePayment(
        undefined,
        {
          input: {
            workspaceId,
            tariffPlanId: planId,
            shouldSaveCard: false,
          },
        },
        mockContext
      );

      expect(result.isCardLinkOperation).toBe(true);

      const oneMonthFromLastChargeDate = new Date(workspace.lastChargeDate);
      oneMonthFromLastChargeDate.setMonth(oneMonthFromLastChargeDate.getMonth() + 1);

      const oneMonthFromLastChargeDateStr = oneMonthFromLastChargeDate.toISOString().split('T')[0];
      const nextPaymentDateStr = result.nextPaymentDate.toISOString().split('T')[0];
      expect(nextPaymentDateStr).toBe(oneMonthFromLastChargeDateStr);
    });

    it('should return isCardLinkOperation = false in case of blocked workspace', async () => {
      const { mockContext, planId, workspaceId } = createComposePaymentTestSetup({
        isTariffPlanExpired: false,
        isBlocked: true,
        lastChargeDate: new Date(),
      });

      const result = await billingNewResolver.Query.composePayment(
        undefined,
        {
          input: {
            workspaceId,
            tariffPlanId: planId,
            shouldSaveCard: false,
          },
        },
        mockContext
      );

      expect(result.isCardLinkOperation).toBe(false);

      // Check that nextPaymentDate is one month from now
      const oneMonthFromNow = new Date();

      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

      const oneMonthFromNowStr = oneMonthFromNow.toISOString().split('T')[0];
      const nextPaymentDateStr = result.nextPaymentDate.toISOString().split('T')[0];

      expect(nextPaymentDateStr).toBe(oneMonthFromNowStr);
    });

    it('should apply valid promo code and store promo id in checksum', async () => {
      const promoCodeId = new ObjectId();
      const { mockContext, planId, workspaceId } = createComposePaymentTestSetup({
        isTariffPlanExpired: true,
        isBlocked: false,
        planMonthlyCharge: 1000,
      });

      withPromoFactories(mockContext, {
        _id: promoCodeId,
        value: 'SAVE25',
        benefit: {
          type: 'percent_discount',
          percent: 25,
        },
      });

      const result = await billingNewResolver.Query.composePayment(
        undefined,
        {
          input: {
            workspaceId,
            tariffPlanId: planId,
            shouldSaveCard: false,
            promoCode: ' save25 ',
          },
        },
        mockContext
      );

      expect(result.plan.monthlyCharge).toBe(1000);
      expect(result.chargeAmount).toBe(750);
      expect(result.promo).toMatchObject({
        originalAmount: 1000,
        finalAmount: 750,
      });

      const checksumData = checksumService.parseAndVerifyChecksum(result.checksum);

      expect(checksumData).toMatchObject({
        promo: { id: promoCodeId.toString() },
      });
    });

    it('should reject invalid promo code', async () => {
      const { mockContext, planId, workspaceId } = createComposePaymentTestSetup({
        isTariffPlanExpired: true,
        isBlocked: false,
      });

      withPromoFactories(mockContext, null);

      await expect(
        billingNewResolver.Query.composePayment(
          undefined,
          {
            input: {
              workspaceId,
              tariffPlanId: planId,
              promoCode: 'missing',
            },
          },
          mockContext
        )
      ).rejects.toMatchObject({
        message: PromoCodeErrorCode.Invalid,
      });
    });

    it('should ignore promo code for card link operation', async () => {
      const { mockContext, planId, workspaceId } = createComposePaymentTestSetup({
        isTariffPlanExpired: false,
        isBlocked: false,
        lastChargeDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        planMonthlyCharge: 1000,
      });

      withPromoFactories(mockContext, {
        _id: new ObjectId(),
        value: 'SAVE25',
        benefit: {
          type: 'percent_discount',
          percent: 25,
        },
      });

      const result = await billingNewResolver.Query.composePayment(
        undefined,
        {
          input: {
            workspaceId,
            tariffPlanId: planId,
            promoCode: 'save25',
          },
        },
        mockContext
      );

      expect(result.isCardLinkOperation).toBe(true);
      expect(result.plan.monthlyCharge).toBe(1000);
      expect(result.chargeAmount).toBe(1);
      expect(result.promo).toBeUndefined();
    });
  });

  describe('verifyPromoCode', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return benefit data without side effects', async () => {
      const promoCodeId = new ObjectId();
      const { mockContext, workspaceId, workspaceMock } = createVerifyPromoCodeTestSetup({
        promoCode: {
          _id: promoCodeId,
          value: 'SAVE25',
          benefit: {
            type: 'percent_discount',
            percent: 25,
          },
        },
      });

      const result = await billingNewResolver.Mutation.verifyPromoCode(
        undefined,
        {
          input: {
            workspaceId,
            value: 'save25',
          },
        },
        mockContext
      );

      expect(result).toMatchObject({
        value: 'SAVE25',
        benefitType: 'percent_discount',
        percent: 25,
      });
      expect(workspaceMock.changePlan).not.toHaveBeenCalled();
    });

    it.each([
      [
        'grant_plan',
        {
          type: 'grant_plan',
          planId: new ObjectId(),
        },
      ],
      [
        'amount_discount',
        {
          type: 'amount_discount',
          amount: 100,
        },
      ],
    ])('should reject unsupported %s promo', async (_type, benefit) => {
      const promoCodeId = new ObjectId();
      const { mockContext, workspaceId } = createVerifyPromoCodeTestSetup({
        promoCode: {
          _id: promoCodeId,
          value: 'UNSUPPORTED',
          benefit,
        },
      });

      await expect(
        billingNewResolver.Mutation.verifyPromoCode(
          undefined,
          {
            input: {
              workspaceId,
              value: 'unsupported',
            },
          },
          mockContext
        )
      ).rejects.toBeInstanceOf(UserInputError);
    });

    it('should reject unknown workspace', async () => {
      const mockContext: ResolverContextWithUser = {
        user: {
          id: new ObjectId().toString(),
          accessTokenExpired: false,
        },
        factories: {
          workspacesFactory: {
            findById: jest.fn().mockResolvedValue(null),
          } as any,
          plansFactory: {} as any,
          usersFactory: {} as any,
          projectsFactory: {} as any,
          businessOperationsFactory: {} as any,
          releasesFactory: {} as any,
          promoCodesFactory: {} as any,
          promoCodeUsagesFactory: {} as any,
        },
      };

      await expect(
        billingNewResolver.Mutation.verifyPromoCode(
          undefined,
          {
            input: {
              workspaceId: new ObjectId().toString(),
              value: 'promo',
            },
          },
          mockContext
        )
      ).rejects.toBeInstanceOf(UserInputError);
    });

    it('should map promo validation errors to public codes', async () => {
      const { mockContext, workspaceId } = createVerifyPromoCodeTestSetup({
        promoCode: null,
      });

      await expect(
        billingNewResolver.Mutation.verifyPromoCode(
          undefined,
          {
            input: {
              workspaceId,
              value: 'missing',
            },
          },
          mockContext
        )
      ).rejects.toMatchObject({
        message: PromoCodeErrorCode.Invalid,
      });
    });
  });

  describe('payWithCard', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should charge full plan amount for recurrent payment', async () => {
      const userId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
      const cardId = 'card-1';
      const newPlanId = new ObjectId();
      const plan: PlanDBScheme = {
        _id: newPlanId,
        name: 'Test Plan',
        monthlyCharge: 1000,
        monthlyChargeCurrency: 'RUB',
        eventsLimit: 1000,
        isDefault: false,
        isHidden: false,
      };
      const checksum = await checksumService.generateChecksum({
        workspaceId,
        userId,
        tariffPlanId: newPlanId.toString(),
        shouldSaveCard: false,
        nextPaymentDate: new Date().toISOString(),
      });
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + 1);

      const mockContext: ResolverContextWithUser = {
        user: {
          id: userId,
          accessTokenExpired: false,
        },
        factories: {
          workspacesFactory: {
            findById: jest.fn().mockResolvedValue({
              _id: new ObjectId(workspaceId),
              tariffPlanId: new ObjectId(),
              isDebug: false,
              getMemberInfo: jest.fn().mockResolvedValue({ isAdmin: true }),
              isTariffPlanExpired: jest.fn().mockReturnValue(true),
              getTariffPlanDueDate: jest.fn().mockReturnValue(dueDate),
            }),
          } as any,
          plansFactory: {
            findById: jest.fn().mockResolvedValue(plan),
          } as any,
          usersFactory: {
            findById: jest.fn().mockResolvedValue({
              bankCards: [{
                id: cardId,
                token: 'token-1',
              }],
            }),
          } as any,
          projectsFactory: {} as any,
          businessOperationsFactory: {
            getBusinessOperationByTransactionId: jest.fn().mockResolvedValue({ _id: new ObjectId() }),
          } as any,
          releasesFactory: {} as any,
          promoCodesFactory: {} as any,
          promoCodeUsagesFactory: {} as any,
        },
      };

      (cloudPaymentsApi.payByToken as jest.Mock).mockResolvedValue({
        Model: {
          TransactionId: 999,
        },
      });

      await billingNewResolver.Mutation.payWithCard(
        undefined,
        {
          input: {
            checksum,
            cardId,
            isRecurrent: true,
          },
        },
        mockContext
      );

      expect(cloudPaymentsApi.payByToken).toHaveBeenCalledWith(
        expect.objectContaining({
          Amount: 1000,
          JsonData: expect.objectContaining({
            cloudPayments: expect.objectContaining({
              recurrent: expect.objectContaining({
                amount: 1000,
              }),
            }),
          }),
        })
      );
    });
  });
})
