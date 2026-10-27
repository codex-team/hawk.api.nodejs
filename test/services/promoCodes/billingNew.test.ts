import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import billingNew from '../../../src/resolvers/billingNew';
import type { ResolverContextWithUser } from '../../../src/types/graphql';
import checksumService from '../../../src/utils/checksumService';
import cloudPaymentsApi from '../../../src/utils/cloudPaymentsApi';
import { databases } from '../../../src/mongo';

jest.mock('../../../src/metrics', () => ({
  setupMongoMetrics: jest.fn(),
  withMongoMetrics: (options: unknown): unknown => options,
}));
jest.mock('../../../src/utils/telegram', () => ({
  ...jest.requireActual('../../../src/utils/telegram'),
  sendMessage: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/utils/cloudPaymentsApi', () => ({
  __esModule: true,
  default: { payByToken: jest.fn() },
}));
jest.mock('../../../src/mongo', () => ({
  databases: {
    hawk: {
      collection: jest.fn(() => {
        throw new Error('Resolver must use factories, not direct MongoDB access');
      }),
    },
  },
}));

describe('Promo payment resolver', () => {
  const previousSecret = process.env.JWT_SECRET_BILLING_CHECKSUM;
  const secret = 'promo-resolver-tests-only';

  beforeAll(() => {
    process.env.JWT_SECRET_BILLING_CHECKSUM = secret;
  });

  beforeEach(() => jest.clearAllMocks());

  afterEach(() => {
    expect(databases.hawk!.collection).not.toHaveBeenCalled();
  });

  afterAll(() => {
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET_BILLING_CHECKSUM;
    } else {
      process.env.JWT_SECRET_BILLING_CHECKSUM = previousSecret;
    }
  });

  function setup() {
    const userId = new ObjectId();
    const plan = {
      _id: new ObjectId(),
      name: 'Paid plan',
      monthlyCharge: 100,
    };
    const workspace = {
      _id: new ObjectId(),
      name: 'Promo workspace',
      tariffPlanId: plan._id,
      lastChargeDate: new Date(),
      isBlocked: false,
      getMemberInfo: jest.fn().mockResolvedValue({
        userId,
        isAdmin: true,
      }),
      isTariffPlanExpired: jest.fn().mockReturnValue(true),
    };
    const quote = {
      promoCodeId: new ObjectId(),
      originalAmount: 100,
      finalAmount: 80,
    };
    const factories = {
      workspacesFactory: { findById: jest.fn().mockResolvedValue(workspace) },
      plansFactory: { findById: jest.fn().mockResolvedValue(plan) },
      usersFactory: { findById: jest.fn() },
      promoCodesFactory: { calculatePromoQuote: jest.fn().mockResolvedValue(quote) },
      promoCodeRedemptionsFactory: { redeem: jest.fn() },
      businessOperationsFactory: { create: jest.fn() },
    };
    const context = {
      user: { id: userId.toString() },
      factories,
    } as unknown as ResolverContextWithUser;
    const input = {
      workspaceId: workspace._id.toString(),
      tariffPlanId: plan._id.toString(),
      shouldSaveCard: true,
      promoCode: '  Promo  ',
    };

    return {
      userId,
      workspace,
      plan,
      quote,
      factories,
      context,
      input,
    };
  }

  test('composePayment calls the quote factory and signs nested promo while retaining outward paymentAmount', async () => {
    const { userId, workspace, plan, quote, factories, context, input } = setup();
    const result = await billingNew.Query.composePayment(undefined, { input }, context);

    expect(factories.promoCodesFactory.calculatePromoQuote).toHaveBeenCalledTimes(1);
    expect(factories.promoCodesFactory.calculatePromoQuote).toHaveBeenCalledWith({
      promoCode: 'Promo',
      userId,
      workspaceId: workspace._id,
      tariffPlanId: plan._id,
      originalAmount: 100,
    });
    expect(result).toMatchObject({
      paymentAmount: 80,
      currency: 'RUB',
      isCardLinkOperation: false,
      plan: { monthlyCharge: 100 },
    });
    const signed = jwt.verify(result.checksum, secret);
    const expected = {
      workspaceId: workspace._id.toString(),
      userId: userId.toString(),
      tariffPlanId: plan._id.toString(),
      shouldSaveCard: true,
      nextPaymentDate: result.nextPaymentDate.toISOString(),
      promo: {
        promoCodeId: quote.promoCodeId.toString(),
        originalAmount: 100,
        finalAmount: 80,
      },
    };

    expect(signed).toEqual({
      ...expected,
      iat: expect.any(Number),
      exp: expect.any(Number),
    });
    expect(checksumService.parseAndVerifyChecksum(result.checksum)).toEqual(expected);
    expect(factories.businessOperationsFactory.create).not.toHaveBeenCalled();
    expect(factories.promoCodeRedemptionsFactory.redeem).not.toHaveBeenCalled();
  });

  test.each([undefined, null, '   '])('no promo (%s) retains ordinary full-price composition', async promoCode => {
    const { factories, context, input } = setup();
    const result = await billingNew.Query.composePayment(undefined, {
      input: {
        ...input,
        promoCode,
      },
    }, context);

    expect(result).toMatchObject({
      paymentAmount: 100,
      isCardLinkOperation: false,
    });
    expect(checksumService.parseAndVerifyChecksum(result.checksum)).not.toHaveProperty('promo');
    expect(factories.promoCodesFactory.calculatePromoQuote).not.toHaveBeenCalled();
  });

  test('card linking rejects a promo before obtaining a quote', async () => {
    const { workspace, factories, context, input } = setup();

    workspace.isTariffPlanExpired.mockReturnValue(false);
    await expect(billingNew.Query.composePayment(undefined, { input }, context)).rejects.toThrow('PROMO_CODE_NOT_AVAILABLE_FOR_CARD_LINK');
    expect(factories.promoCodesFactory.calculatePromoQuote).not.toHaveBeenCalled();
  });

  test('non-admin members cannot obtain a promo quote', async () => {
    const { workspace, factories, context, input } = setup();

    workspace.getMemberInfo.mockResolvedValue({
      userId: new ObjectId(),
      isAdmin: false,
    });
    await expect(billingNew.Query.composePayment(undefined, { input }, context)).rejects.toThrow('PROMO_CODE_ADMIN_REQUIRED');
    expect(factories.promoCodesFactory.calculatePromoQuote).not.toHaveBeenCalled();
  });

  test('quote validation errors propagate without creating an operation', async () => {
    const { factories, context, input } = setup();

    factories.promoCodesFactory.calculatePromoQuote.mockRejectedValueOnce(new Error('PROMO_CODE_INVALID'));
    await expect(billingNew.Query.composePayment(undefined, { input }, context)).rejects.toThrow('PROMO_CODE_INVALID');
    expect(factories.businessOperationsFactory.create).not.toHaveBeenCalled();
    expect(factories.promoCodeRedemptionsFactory.redeem).not.toHaveBeenCalled();
  });

  test.each([false, true])('payWithCard rejects a signed promo before lookup or charging (recurrent: %s)', async isRecurrent => {
    const { userId, workspace, plan, quote, factories, context } = setup();
    const checksum = await checksumService.generateChecksum({
      workspaceId: workspace._id.toString(),
      userId: userId.toString(),
      tariffPlanId: plan._id.toString(),
      shouldSaveCard: false,
      nextPaymentDate: '2026-11-13T12:00:00.000Z',
      promo: {
        promoCodeId: quote.promoCodeId.toString(),
        originalAmount: 100,
        finalAmount: 80,
      },
    });

    await expect(billingNew.Mutation.payWithCard(undefined, {
      input: {
        checksum,
        cardId: 'saved-card',
        isRecurrent,
      },
    }, context))
      .rejects.toThrow('PROMO_CODE_NOT_AVAILABLE_FOR_SAVED_CARD');
    expect(cloudPaymentsApi.payByToken).not.toHaveBeenCalled();
    expect(factories.usersFactory.findById).not.toHaveBeenCalled();
    expect(factories.workspacesFactory.findById).not.toHaveBeenCalled();
    expect(factories.plansFactory.findById).not.toHaveBeenCalled();
    expect(factories.businessOperationsFactory.create).not.toHaveBeenCalled();
  });
});
