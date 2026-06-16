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

/** Plan price before promo (RUB) */
const PLAN_MONTHLY_CHARGE = 1000;

/** Expected charge after 25% promo discount (RUB) */
const PROMO_DISCOUNTED_CHARGE = 750;

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

  afterEach(async () => {
    await accountsDb.dropDatabase();
  });

  /**
   * Insert a document and load the persisted record.
   * Throws if insert or read fails — keeps fixture setup explicit in tests.
   */
  async function insertAndLoad<T extends { _id?: ObjectId }, R extends T>(
    collection: Collection<T>,
    document: Omit<T, '_id'>,
    errorMessage: string
  ): Promise<R> {
    const insertedId = (await collection.insertOne(document as T)).insertedId;
    const result = await collection.findOne({ _id: insertedId } as Partial<T>);

    if (!result) {
      throw new Error(errorMessage);
    }

    return result as R;
  }

  /**
   * Seed workspace, admin, target plan and promo code for promo billing tests.
   *
   * Workspace starts on a cheap current plan; payment targets `planToChange` (1000 RUB).
   * Promo `SAVE25` gives 25% off → expected first charge is 750 RUB.
   * Admin is added to workspace team so check/pay webhooks pass membership checks.
   */
  async function seedPromoBillingFixtures(): Promise<void> {
    const currentPlanId = (await plansCollection.insertOne({
      name: 'CurrentTestPlan',
      monthlyCharge: 10,
      monthlyChargeCurrency: 'RUB',
      eventsLimit: 1000,
      isDefault: false,
    })).insertedId;

    workspace = await insertAndLoad(
      workspacesCollection,
      {
        name: 'PromoBillingTest',
        accountId: '123',
        tariffPlanId: currentPlanId,
      } as WorkspaceDBScheme,
      'Failed to create workspace'
    );

    admin = await insertAndLoad(
      usersCollection,
      { email: 'admin@promo-billing.test' },
      'Failed to create admin'
    );

    planToChange = await insertAndLoad(
      plansCollection,
      {
        name: 'PromoBasic',
        monthlyCharge: PLAN_MONTHLY_CHARGE,
        monthlyChargeCurrency: 'RUB',
        eventsLimit: 10000,
        isDefault: false,
      },
      'Failed to create planToChange'
    );

    promoCode = await insertAndLoad(
      promoCodesCollection,
      {
        value: 'SAVE25',
        benefit: {
          type: 'percent_discount',
          percent: 25,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: admin._id.toString(),
      },
      'Failed to create promo code'
    );

    const team = accountsDb.collection<Omit<ConfirmedMemberDBScheme, '_id'>>(`team:${workspace._id.toString()}`);

    await team.insertOne({
      userId: admin._id,
      isAdmin: true,
    });
  }

  /**
   * Checksum from composePayment with promo id embedded.
   * CloudPayments check/pay handlers revalidate amount against this promo.
   */
  async function buildPromoChecksum(): Promise<string> {
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

  /**
   * Build /billing/check request with promo checksum and recurrent subscription metadata.
   */
  async function buildPromoCheckRequest(chargeAmount: number): Promise<CheckRequest> {
    return {
      ...mainRequest,
      Amount: chargeAmount.toString(),
      Currency: Currency.RUB,
      Data: JSON.stringify({
        checksum: await buildPromoChecksum(),
        cloudPayments: {
          recurrent: {
            interval: 'Month',
            period: 1,
            amount: PLAN_MONTHLY_CHARGE,
          },
        },
      }),
    };
  }

  beforeEach(async () => {
    await seedPromoBillingFixtures();
  });

  describe('/billing/check', () => {
    describe('with promo code', () => {
      it('should accept discounted charge amount and create pending business operation', async () => {
        const apiResponse = await apiInstance.post('/billing/check', await buildPromoCheckRequest(PROMO_DISCOUNTED_CHARGE));
        const createdBusinessOperation = await businessOperationsCollection.findOne({
          transactionId: transactionId.toString(),
        });

        expect(apiResponse.data.code).toBe(CheckCodes.SUCCESS);
        /**
         * /billing/check only validates payment and registers intent.
         * Business operation stays Pending until /billing/pay confirms the charge.
         */
        expect(createdBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
      });

      it('should return WRONG_AMOUNT when charge equals full plan price instead of promo discount', async () => {
        const apiResponse = await apiInstance.post('/billing/check', await buildPromoCheckRequest(PLAN_MONTHLY_CHARGE));

        expect(apiResponse.data.code).toBe(CheckCodes.WRONG_AMOUNT);
      });
    });
  });

  describe('/billing/pay', () => {
    describe('with promo code', () => {
      let validPayRequestData: PayRequest;

      beforeEach(async () => {
        /**
         * /billing/pay expects check webhook to have already created a Pending operation
         * for the same transactionId — mirrors real CloudPayments two-step flow.
         */
        await businessOperationsCollection.insertOne({
          transactionId: transactionId.toString(),
          type: BusinessOperationType.WorkspacePlanPurchase,
          status: BusinessOperationStatus.Pending,
          dtCreated: new Date(),
          payload: {
            workspaceId: workspace._id,
            amount: PROMO_DISCOUNTED_CHARGE * 100,
            currency: Currency.RUB,
            userId: admin._id,
            tariffPlanId: planToChange._id,
          },
        });

        validPayRequestData = {
          Amount: PROMO_DISCOUNTED_CHARGE.toString(),
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
          originalAmount: PLAN_MONTHLY_CHARGE,
          finalAmount: PROMO_DISCOUNTED_CHARGE,
          discountAmount: PLAN_MONTHLY_CHARGE - PROMO_DISCOUNTED_CHARGE,
        });
      });
    });
  });
});
