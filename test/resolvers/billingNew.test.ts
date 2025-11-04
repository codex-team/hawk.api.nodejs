import '../../src/env-test';
import { ObjectId } from 'mongodb';
import { PlanDBScheme, WorkspaceDBScheme } from '@hawk.so/types';
import billingNewResolver from '../../src/resolvers/billingNew';
import { ResolverContextWithUser } from '../../src/types/graphql';

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
    eventsFactoryCache: new Map(),
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
  });
})
