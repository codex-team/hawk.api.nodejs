import '../../src/env-test';

jest.mock('../../src/utils/cloudPaymentsApi', () => ({
  __esModule: true,
  default: {
    payByToken: jest.fn(),
  },
}));

import { ObjectId } from 'mongodb';
import { PlanDBScheme, WorkspaceDBScheme } from '@hawk.so/types';
import billingNewResolver from '../../src/resolvers/billingNew';
import { ResolverContextWithUser } from '../../src/types/graphql';
import checksumService from '../../src/utils/checksumService';
import cloudPaymentsApi from '../../src/utils/cloudPaymentsApi';
import {
  PromoCodeContext,
  PromoCodeError,
  PromoCodeErrorCode
} from '../../src/services/promoCodeService';

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
  const quotePromoCode = jest.fn();

  const mockContext = {
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
    },
    promoCodeService: {
      quote: quotePromoCode,
    } as any,
  } as ResolverContextWithUser & PromoCodeContext;

  return {
    userId,
    workspaceId,
    planId,
    plan,
    workspace,
    mockContext,
    mockWorkspacesFactory,
    mockPlansFactory,
    quotePromoCode,
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
      expect(result.chargeAmount).toBe(1000);

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
      expect(result.chargeAmount).toBe(1);

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
      expect(result.chargeAmount).toBe(1000);

      // Check that nextPaymentDate is one month from now
      const oneMonthFromNow = new Date();

      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

      const oneMonthFromNowStr = oneMonthFromNow.toISOString().split('T')[0];
      const nextPaymentDateStr = result.nextPaymentDate.toISOString().split('T')[0];

      expect(nextPaymentDateStr).toBe(oneMonthFromNowStr);
    });

    it('should return the server-calculated promo amount in the signed checksum', async () => {
      // Arrange
      const promoCodeId = new ObjectId();
      const {
        mockContext,
        planId,
        workspaceId,
        quotePromoCode,
      } = createComposePaymentTestSetup({
        isTariffPlanExpired: true,
      });

      quotePromoCode.mockResolvedValue({
        promoCodeId,
        finalAmount: 750,
      });

      // Act
      const result = await billingNewResolver.Query.composePayment(
        undefined,
        {
          input: {
            workspaceId,
            tariffPlanId: planId,
            promoCode: 'save25',
            promoUtm: { source: 'test' },
          },
        },
        mockContext
      );
      const checksumData = checksumService.parseAndVerifyChecksum(result.checksum);

      // Assert
      expect(result.chargeAmount).toBe(750);
      expect(checksumData).toMatchObject({
        tariffPlanId: planId,
        isCardLinkOperation: false,
        chargeAmount: 750,
        promoCodeId: promoCodeId.toString(),
        promoUtm: { source: 'test' },
      });
    });

    it('should map promo validation errors to a stable client code', async () => {
      // Arrange
      const {
        mockContext,
        planId,
        workspaceId,
        quotePromoCode,
      } = createComposePaymentTestSetup({
        isTariffPlanExpired: true,
      });

      quotePromoCode.mockRejectedValue(
        new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo code not found')
      );

      // Act
      const promise = billingNewResolver.Query.composePayment(
        undefined,
        {
          input: {
            workspaceId,
            tariffPlanId: planId,
            promoCode: 'missing',
          },
        },
        mockContext
      );

      // Assert
      await expect(promise).rejects.toMatchObject({
        message: PromoCodeErrorCode.Invalid,
      });
    });
  });

  describe('payWithCard', () => {
    it('should use signed first charge amount and full recurrent amount', async () => {
      // Arrange
      const userId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
      const planId = new ObjectId();
      const nextPaymentDate = new Date('2026-10-01T00:00:00.000Z').toISOString();
      const checksum = await checksumService.generateChecksum({
        workspaceId,
        userId,
        tariffPlanId: planId.toString(),
        shouldSaveCard: false,
        isCardLinkOperation: false,
        chargeAmount: 750,
        nextPaymentDate,
        promoCodeId: new ObjectId().toString(),
      });
      const plan: PlanDBScheme = {
        _id: planId,
        name: 'Test Plan',
        monthlyCharge: 1000,
        monthlyChargeCurrency: 'RUB',
        eventsLimit: 1000,
        isDefault: false,
        isHidden: false,
      };
      const context = {
        user: {
          id: userId,
          accessTokenExpired: false,
        },
        factories: {
          workspacesFactory: {
            findById: jest.fn().mockResolvedValue({
              _id: new ObjectId(workspaceId),
              tariffPlanId: planId,
              isDebug: false,
              getMemberInfo: jest.fn().mockResolvedValue({ isAdmin: true }),
              isTariffPlanExpired: jest.fn().mockReturnValue(false),
            }),
          } as any,
          plansFactory: {
            findById: jest.fn().mockResolvedValue(plan),
          } as any,
          usersFactory: {
            findById: jest.fn().mockResolvedValue({
              bankCards: [{ id: 'card-1', token: 'token-1' }],
            }),
          } as any,
          projectsFactory: {} as any,
          businessOperationsFactory: {
            getBusinessOperationByTransactionId: jest.fn().mockResolvedValue({ _id: new ObjectId() }),
          } as any,
          releasesFactory: {} as any,
        },
      } as ResolverContextWithUser;

      (cloudPaymentsApi.payByToken as jest.Mock).mockResolvedValue({
        Model: { TransactionId: 1001 },
      });

      // Act
      await billingNewResolver.Mutation.payWithCard(
        undefined,
        {
          input: {
            checksum,
            cardId: 'card-1',
            isRecurrent: true,
          },
        },
        context
      );

      // Assert
      expect(cloudPaymentsApi.payByToken).toHaveBeenCalledWith(expect.objectContaining({
        Amount: 750,
        JsonData: expect.objectContaining({
          cloudPayments: {
            recurrent: {
              interval: 'Month',
              period: 1,
              amount: 1000,
              startDate: nextPaymentDate,
            },
          },
        }),
      }));
    });
  });
});
