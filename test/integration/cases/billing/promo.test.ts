import { apiInstance } from '../../utils';
import { CheckCodes, CheckRequest, PayCodes, PayRequest } from '../../../../src/billing/types';
import { CardType, Currency, OperationStatus, OperationType } from '../../../../src/billing/types/enums';
import { Collection, Db, ObjectId } from 'mongodb';
import {
  BusinessOperationDBScheme,
  BusinessOperationStatus,
  BusinessOperationType,
  ConfirmedMemberDBScheme,
  PlanDBScheme,
  PromoCodeDBScheme,
  PromoCodeUsageDBScheme,
  UserDBScheme,
  WorkspaceDBScheme,
} from '@hawk.so/types';
import checksumService from '../../../../src/utils/checksumService';
import { mainRequest, transactionId } from '../../billingMocks';
import type { Global } from '@jest/types';

 declare var global: Global.Global;

describe('Promo billing webhooks', () => {
  let accountsDb: Db;
  let businessOperationsCollection: Collection<BusinessOperationDBScheme>;
  let workspacesCollection: Collection<WorkspaceDBScheme>;
  let plansCollection: Collection<Omit<PlanDBScheme, '_id'>>;
  let usersCollection: Collection<Omit<UserDBScheme, '_id'>>;
  let promoCodesCollection: Collection<Omit<PromoCodeDBScheme, '_id'>>;
  let promoCodeUsagesCollection: Collection<Omit<PromoCodeUsageDBScheme, '_id'>>;

  let workspace: WorkspaceDBScheme;
  let admin: UserDBScheme;
  let planToChange: PlanDBScheme;
  let promoCode: PromoCodeDBScheme;

  beforeAll(async () => {
    accountsDb = await global.mongoClient.db('hawk');

    workspacesCollection = accountsDb.collection<WorkspaceDBScheme>('workspaces');
    usersCollection = accountsDb.collection<Omit<UserDBScheme, '_id'>>('users');
    plansCollection = accountsDb.collection<Omit<PlanDBScheme, '_id'>>('plans');
    businessOperationsCollection = accountsDb.collection<BusinessOperationDBScheme>('businessOperations');
    promoCodesCollection = accountsDb.collection<Omit<PromoCodeDBScheme, '_id'>>('promoCodes');
    promoCodeUsagesCollection = accountsDb.collection<Omit<PromoCodeUsageDBScheme, '_id'>>('promoCodeUsages');
  });

  beforeEach(async () => {
    const currentPlanId = (await plansCollection.insertOne({
      name: 'CurrentTestPlan',
      monthlyCharge: 10,
      monthlyChargeCurrency: 'RUB',
      eventsLimit: 1000,
      isDefault: false,
    })).insertedId;

    const workspaceId = (await workspacesCollection.insertOne({
      name: 'PromoBillingTest',
      accountId: '123',
      tariffPlanId: currentPlanId,
    } as WorkspaceDBScheme)).insertedId;
    const workspaceResult = await workspacesCollection.findOne({ _id: workspaceId });

    if (!workspaceResult) {
      throw new Error('Failed to create workspace');
    }

    workspace = workspaceResult as WorkspaceDBScheme;

    const adminId = (await usersCollection.insertOne({
      email: 'admin@promo-billing.test',
    })).insertedId;
    const adminResult = await usersCollection.findOne({ _id: adminId });

    if (!adminResult) {
      throw new Error('Failed to create admin');
    }

    admin = adminResult as UserDBScheme;

    const planToChangeId = (await plansCollection.insertOne({
      name: 'PromoBasic',
      monthlyCharge: 1000,
      monthlyChargeCurrency: 'RUB',
      eventsLimit: 10000,
      isDefault: false,
    })).insertedId;
    const planToChangeResult = await plansCollection.findOne({ _id: planToChangeId });

    if (!planToChangeResult) {
      throw new Error('Failed to create planToChange');
    }

    planToChange = planToChangeResult as PlanDBScheme;

    const promoCodeId = (await promoCodesCollection.insertOne({
      value: 'SAVE25',
      benefit: {
        type: 'percent_discount',
        percent: 25,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: admin._id.toString(),
    })).insertedId;
    const promoCodeResult = await promoCodesCollection.findOne({ _id: promoCodeId });

    if (!promoCodeResult) {
      throw new Error('Failed to create promo code');
    }

    promoCode = promoCodeResult as PromoCodeDBScheme;

    const team = accountsDb.collection<Omit<ConfirmedMemberDBScheme, '_id'>>(`team:${workspace._id.toString()}`);

    await team.insertOne({
      userId: admin._id,
      isAdmin: true,
    });
  });

  afterEach(async () => {
    await accountsDb.dropDatabase();
  });

  async function buildPromoChecksum() {
    return checksumService.generateChecksum({
      workspaceId: workspace._id.toString(),
      userId: admin._id.toString(),
      tariffPlanId: planToChange._id.toString(),
      shouldSaveCard: false,
      nextPaymentDate: new Date().toISOString(),
      promo: {
        id: promoCode._id.toString(),
      },
    });
  }

  describe('/billing/check', () => {
    it('should accept discounted amount when promo is valid', async () => {
      const data: CheckRequest = {
        ...mainRequest,
        Amount: '750',
        Currency: Currency.RUB,
        Data: JSON.stringify({
          checksum: await buildPromoChecksum(),
          cloudPayments: {
            recurrent: {
              interval: 'Month',
              period: 1,
              amount: 1000,
            },
          },
        }),
      };

      const apiResponse = await apiInstance.post('/billing/check', data);
      const createdBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(CheckCodes.SUCCESS);
      expect(createdBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
    });

    it('should reject full plan amount when promo expects discounted charge', async () => {
      const data: CheckRequest = {
        ...mainRequest,
        Amount: '1000',
        Currency: Currency.RUB,
        Data: JSON.stringify({
          checksum: await buildPromoChecksum(),
          cloudPayments: {
            recurrent: {
              interval: 'Month',
              period: 1,
              amount: 1000,
            },
          },
        }),
      };

      const apiResponse = await apiInstance.post('/billing/check', data);

      expect(apiResponse.data.code).toBe(CheckCodes.WRONG_AMOUNT);
    });
  });

  describe('/billing/pay', () => {
    let validPayRequestData: PayRequest;

    beforeEach(async () => {
      await businessOperationsCollection.insertOne({
        transactionId: transactionId.toString(),
        type: BusinessOperationType.WorkspacePlanPurchase,
        status: BusinessOperationStatus.Pending,
        dtCreated: new Date(),
        payload: {
          workspaceId: workspace._id,
          amount: 75000,
          currency: Currency.RUB,
          userId: admin._id,
          tariffPlanId: planToChange._id,
        },
      });

      validPayRequestData = {
        Amount: '750',
        CardExpDate: '06/25',
        CardFirstSix: '578946',
        CardLastFour: '5367',
        CardType: CardType.VISA,
        Currency: Currency.RUB,
        DateTime: new Date(),
        GatewayName: 'CodeX bank',
        OperationType: OperationType.PAYMENT,
        Status: OperationStatus.COMPLETED,
        TestMode: false,
        TransactionId: transactionId,
        Token: '123123',
        IssuerBankCountry: 'US',
        Data: JSON.stringify({
          checksum: await buildPromoChecksum(),
        }),
      };
    });

    it('should change plan and record promo usage after successful payment', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', validPayRequestData);

      const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });
      const promoUsage = await promoCodeUsagesCollection.findOne({ promoCodeId: promoCode._id });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedWorkspace?.tariffPlanId.toString()).toBe(planToChange._id.toString());
      expect(promoUsage).toMatchObject({
        promoCodeId: promoCode._id,
        userId: admin._id.toString(),
        workspaceId: workspace._id,
        planId: planToChange._id,
        benefitType: 'percent_discount',
        originalAmount: 1000,
        finalAmount: 750,
        discountAmount: 250,
      });
    });
  });
});
