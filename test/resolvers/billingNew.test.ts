import '../../src/env-test';
import { ObjectId } from 'mongodb';
import { PlanDBScheme, WorkspaceDBScheme, UserDBScheme } from '@hawk.so/types';
import billingNewResolver from '../../src/resolvers/billingNew';
import { ResolverContextWithUser } from '../../src/types/graphql';

// Мокаем telegram модуль
// jest.mock('../../src/utils/telegram', () => ({
//   sendMessage: jest.fn().mockResolvedValue(undefined),
//   TelegramBotURLs: {
//     Base: 'base',
//     Money: 'money',
//   },
// }));

// Устанавливаем переменные окружения для теста
process.env.JWT_SECRET_BILLING_CHECKSUM = 'checksum_secret';
process.env.JWT_SECRET_ACCESS_TOKEN = 'belarus';
process.env.JWT_SECRET_REFRESH_TOKEN = 'abacaba';
process.env.JWT_SECRET_PROJECT_TOKEN = 'qwerty';

describe('GraphQLBillingNew', () => {
  describe('composePayment', () => {
    it('should return isCardLinkOperation = false in case of expired tariff plan', async () => {
      const userId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
      const planId = new ObjectId().toString();
      
      const plan: PlanDBScheme = {
        _id: new ObjectId(planId),
        name: 'Test Plan',
        monthlyCharge: 1000,
        monthlyChargeCurrency: 'RUB',
        eventsLimit: 1000,
        isDefault: false,
        isHidden: false,
      };

      // Workspace with expired tariff plan
      const expiredDate = new Date();
      expiredDate.setMonth(expiredDate.getMonth() - 2);
      
      const workspace: WorkspaceDBScheme = {
        _id: new ObjectId(workspaceId),
        name: 'Test Workspace',
        accountId: 'test-account-id',
        balance: 0,
        billingPeriodEventsCount: 0,
        isBlocked: false,
        lastChargeDate: expiredDate,
        tariffPlanId: new ObjectId(planId),
        inviteHash: 'test-invite-hash',
        subscriptionId: undefined,
      };

      // Mock workspaces factory
      const mockWorkspacesFactory = {
        findById: jest.fn().mockResolvedValue({
          ...workspace,
          getMemberInfo: jest.fn().mockResolvedValue({ isAdmin: true }),
          isTariffPlanExpired: jest.fn().mockReturnValue(true), // План истек
          isBlocked: false,
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
        },
      };

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
      expect(result.plan.monthlyCharge).toBe(1000);
      expect(result.currency).toBe('RUB');
      
      // Check that nextPaymentDate is one month from now
      const oneMonthFromNow = new Date();
      
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

      const oneMonthFromNowStr = oneMonthFromNow.toISOString().split('T')[0];
      const nextPaymentDateStr = result.nextPaymentDate.toISOString().split('T')[0];
      
      expect(nextPaymentDateStr).toBe(oneMonthFromNowStr);
    });

    it('should return isCardLinkOperation = true in case of active tariff plan', async () => {
      const userId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
      const planId = new ObjectId().toString();
      
      
      const plan: PlanDBScheme = {
        _id: new ObjectId(planId),
        name: 'Test Plan',
        monthlyCharge: 1000,
        monthlyChargeCurrency: 'RUB',
        eventsLimit: 1000,
        isDefault: false,
        isHidden: false,
      };

      const lastChargeDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // Last charge date is 2 days ago

      const workspace: WorkspaceDBScheme = {
        _id: new ObjectId(workspaceId),
        name: 'Test Workspace',
        accountId: 'test-account-id',
        balance: 0,
        billingPeriodEventsCount: 0,
        isBlocked: false,
        lastChargeDate,
        tariffPlanId: new ObjectId(planId),
        inviteHash: 'test-invite-hash',
        subscriptionId: undefined,
      };

      const mockWorkspacesFactory = {
        findById: jest.fn().mockResolvedValue({
          ...workspace,
          getMemberInfo: jest.fn().mockResolvedValue({ isAdmin: true }),
          isTariffPlanExpired: jest.fn().mockReturnValue(false),
        }),
      };
      
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
        },
      };

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
      expect(result.plan.monthlyCharge).toBe(1000);
      expect(result.currency).toBe('RUB');
      
      const oneMonthFromLastChargeDate = new Date(lastChargeDate);
      oneMonthFromLastChargeDate.setMonth(oneMonthFromLastChargeDate.getMonth() + 1);

      const oneMonthFromLastChargeDateStr = oneMonthFromLastChargeDate.toISOString().split('T')[0];
      const nextPaymentDateStr = result.nextPaymentDate.toISOString().split('T')[0];
      expect(nextPaymentDateStr).toBe(oneMonthFromLastChargeDateStr);
    });

    it('should return isCardLinkOperation = false in case of blocked workspace', async () => {
      const userId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
      const planId = new ObjectId().toString();

      const plan: PlanDBScheme = {
        _id: new ObjectId(planId),
        name: 'Test Plan',
        monthlyCharge: 1000,
        monthlyChargeCurrency: 'RUB',
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
        isBlocked: true,
        lastChargeDate: new Date(),
        tariffPlanId: new ObjectId(planId),
        inviteHash: 'test-invite-hash',
        subscriptionId: undefined,
      };
      
      const mockWorkspacesFactory = {
        findById: jest.fn().mockResolvedValue({
          ...workspace,
          getMemberInfo: jest.fn().mockResolvedValue({ isAdmin: true }),
          isTariffPlanExpired: jest.fn().mockReturnValue(false),
        }),
      };
      
      
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
        },
      };
      
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
      expect(result.plan.monthlyCharge).toBe(1000);
      expect(result.currency).toBe('RUB');

      // Check that nextPaymentDate is one month from now
      const oneMonthFromNow = new Date();
      
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

      const oneMonthFromNowStr = oneMonthFromNow.toISOString().split('T')[0];
      const nextPaymentDateStr = result.nextPaymentDate.toISOString().split('T')[0];
      
      expect(nextPaymentDateStr).toBe(oneMonthFromNowStr);
    });
  });
})
