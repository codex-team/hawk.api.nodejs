import { ObjectId } from 'mongodb';
import PromoCodeService, {
  normalizePromoCodeValue,
  PromoCodeError,
  PromoCodeErrorCode
} from '../../src/services/promoCodeService';
import { calculatePromoCodePlanPrice } from '../../src/utils/promoCodePricing';

function createPlan(overrides: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(),
    name: 'Basic',
    monthlyCharge: 1000,
    monthlyChargeCurrency: 'RUB',
    eventsLimit: 1000,
    isDefault: false,
    isHidden: false,
    ...overrides,
  } as any;
}

function createPromoCode(benefit: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(),
    value: 'PROMO',
    benefit,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: new ObjectId().toString(),
    ...overrides,
  } as any;
}

function createService(promoCode: any, options: {
  totalUses?: number;
  userUsage?: unknown;
  workspaceUsage?: unknown;
  plans?: any[];
  plan?: any;
} = {}) {
  const plan = options.plan || createPlan();

  return new PromoCodeService({
    promoCodesFactory: {
      findByValue: jest.fn().mockResolvedValue(promoCode),
      findOne: jest.fn().mockResolvedValue(promoCode),
    },
    promoCodeUsagesFactory: {
      countByPromoCodeId: jest.fn().mockResolvedValue(options.totalUses ?? 0),
      findByPromoCodeAndUser: jest.fn().mockResolvedValue(options.userUsage ?? null),
      findByPromoCodeAndWorkspace: jest.fn().mockResolvedValue(options.workspaceUsage ?? null),
      create: jest.fn().mockResolvedValue({ _id: new ObjectId() }),
    },
    plansFactory: {
      findAll: jest.fn().mockResolvedValue(options.plans || [plan]),
      findById: jest.fn().mockResolvedValue(plan),
    },
  } as any);
}

async function expectPromoError(promise: Promise<unknown>, code: PromoCodeErrorCode): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    code,
  } as PromoCodeError);
}

describe('PromoCodeService', () => {
  describe('normalizePromoCodeValue()', () => {
    it('should trim and uppercase value before lookup', () => {
      expect(normalizePromoCodeValue(' promo_2026 ')).toBe('PROMO_2026');
    });
  });

  describe('calculatePromoCodePlanPrice()', () => {
    it('should apply percent discount with min final price cap', () => {
      const plan = createPlan({ monthlyCharge: 1000 });
      const price = calculatePromoCodePlanPrice({
        type: 'percent_discount',
        percent: 90,
        minFinalPrice: 200,
      } as any, plan);

      expect(price).toMatchObject({
        isApplicable: true,
        originalAmount: 1000,
        finalAmount: 200,
        discountAmount: 800,
      });
    });

    it('should clamp non-positive minFinalPrice to default floor', () => {
      const plan = createPlan({ monthlyCharge: 1000 });
      const price = calculatePromoCodePlanPrice({
        type: 'percent_discount',
        percent: 100,
        minFinalPrice: 0,
      } as any, plan);

      expect(price).toMatchObject({
        isApplicable: true,
        originalAmount: 1000,
        finalAmount: 1,
        discountAmount: 999,
      });
    });

    it('should apply fixed price promo', () => {
      const plan = createPlan({ monthlyCharge: 1000 });
      const price = calculatePromoCodePlanPrice({
        type: 'fixed_price',
        amount: 299,
      } as any, plan);

      expect(price.finalAmount).toBe(299);
      expect(price.discountAmount).toBe(701);
    });

    it('should not apply discount when plan is outside applicablePlanIds', () => {
      const plan = createPlan({ monthlyCharge: 1000 });
      const price = calculatePromoCodePlanPrice({
        type: 'percent_discount',
        percent: 50,
        applicablePlanIds: [new ObjectId()],
      } as any, plan);

      expect(price).toMatchObject({
        isApplicable: false,
        finalAmount: 1000,
        discountAmount: 0,
      });
    });

    it('should not apply discount promos to free plan', () => {
      const plan = createPlan({ monthlyCharge: 0 });
      const price = calculatePromoCodePlanPrice({
        type: 'percent_discount',
        percent: 20,
      } as any, plan);

      expect(price).toMatchObject({
        isApplicable: false,
        originalAmount: 0,
        finalAmount: 0,
        discountAmount: 0,
      });
    });

    it('should not apply fixed price promo when it is not cheaper than plan price', () => {
      const plan = createPlan({ monthlyCharge: 100 });
      const price = calculatePromoCodePlanPrice({
        type: 'fixed_price',
        amount: 100,
      } as any, plan);

      expect(price).toMatchObject({
        isApplicable: false,
        finalAmount: 100,
        discountAmount: 0,
      });
    });
  });

  describe('verifyPromoCode()', () => {
    it('should return benefit data for percent discount promo', async () => {
      const plan = createPlan({ monthlyCharge: 1000 });
      const promoCode = createPromoCode({
        type: 'percent_discount',
        percent: 25,
      });
      const service = createService(promoCode, { plan });

      const result = await service.verifyPromoCode(' promo ', new ObjectId().toString(), new ObjectId().toString());

      expect(result).toMatchObject({
        value: 'PROMO',
        benefitType: 'percent_discount',
        percent: 25,
      });
      expect(result.applicablePlanIds).toBeUndefined();
    });

    it('should reject unknown promo code', async () => {
      const service = createService(null);

      await expectPromoError(service.verifyPromoCode('missing', new ObjectId().toString(), new ObjectId().toString()), PromoCodeErrorCode.Invalid);
    });

    it('should reject expired promo code', async () => {
      const promoCode = createPromoCode({
        type: 'fixed_price',
        amount: 100,
      }, {
        expiresAt: new Date(Date.now() - 1000),
      });
      const service = createService(promoCode);

      await expectPromoError(service.verifyPromoCode('promo', new ObjectId().toString(), new ObjectId().toString()), PromoCodeErrorCode.Invalid);
    });

    it('should reject total usage limit', async () => {
      const promoCode = createPromoCode({
        type: 'fixed_price',
        amount: 100,
      }, {
        limit: 1,
      });
      const service = createService(promoCode, { totalUses: 1 });

      await expectPromoError(service.verifyPromoCode('promo', new ObjectId().toString(), new ObjectId().toString()), PromoCodeErrorCode.LimitExceeded);
    });

    it('should reject user usage limit', async () => {
      const promoCode = createPromoCode({
        type: 'fixed_price',
        amount: 100,
      });
      const service = createService(promoCode, { userUsage: {} });

      await expectPromoError(service.verifyPromoCode('promo', new ObjectId().toString(), new ObjectId().toString()), PromoCodeErrorCode.LimitExceeded);
    });

    it('should reject workspace usage limit', async () => {
      const promoCode = createPromoCode({
        type: 'fixed_price',
        amount: 100,
      });
      const service = createService(promoCode, { workspaceUsage: {} });

      await expectPromoError(service.verifyPromoCode('promo', new ObjectId().toString(), new ObjectId().toString()), PromoCodeErrorCode.LimitExceeded);
    });

    it('should reject invalid benefit structure', async () => {
      const promoCode = createPromoCode({
        type: 'percent_discount',
        percent: 101,
      });
      const service = createService(promoCode);

      await expectPromoError(service.verifyPromoCode('promo', new ObjectId().toString(), new ObjectId().toString()), PromoCodeErrorCode.Invalid);
    });

    it.each([0, -1, Number.NaN])('should reject percent discount with invalid minFinalPrice %p', async (minFinalPrice) => {
      const promoCode = createPromoCode({
        type: 'percent_discount',
        percent: 50,
        minFinalPrice,
      });
      const service = createService(promoCode);

      await expectPromoError(service.verifyPromoCode('promo', new ObjectId().toString(), new ObjectId().toString()), PromoCodeErrorCode.Invalid);
    });
  });

  describe('getPricingForPlan()', () => {
    it('should reject unsupported amount_discount promo', async () => {
      const plan = createPlan({ monthlyCharge: 1000 });
      const promoCode = createPromoCode({
        type: 'amount_discount',
        amount: 100,
      });
      const service = createService(promoCode);

      await expectPromoError(
        service.getPricingForPlan('promo', new ObjectId().toString(), new ObjectId().toString(), plan),
        PromoCodeErrorCode.Invalid
      );
    });

    it('should reject unsupported grant_plan promo', async () => {
      const plan = createPlan({ monthlyCharge: 1000 });
      const promoCode = createPromoCode({
        type: 'grant_plan',
        planId: new ObjectId(),
      });
      const service = createService(promoCode);

      await expectPromoError(
        service.getPricingForPlan('promo', new ObjectId().toString(), new ObjectId().toString(), plan),
        PromoCodeErrorCode.Invalid
      );
    });

    it('should reject selected plan when promo is not applicable', async () => {
      const plan = createPlan({ monthlyCharge: 1000 });
      const promoCode = createPromoCode({
        type: 'percent_discount',
        percent: 10,
        applicablePlanIds: [new ObjectId()],
      });
      const service = createService(promoCode);

      await expectPromoError(
        service.getPricingForPlan('promo', new ObjectId().toString(), new ObjectId().toString(), plan),
        PromoCodeErrorCode.Invalid
      );
    });
  });

  describe('createUsage()', () => {
    it('should resolve pricing by promo id and create usage record', async () => {
      const plan = createPlan({ monthlyCharge: 1000 });
      const promoCode = createPromoCode({
        type: 'percent_discount',
        percent: 25,
      });
      const service = createService(promoCode, { plan });

      const usage = await service.createUsage({
        promoCodeId: promoCode._id.toString(),
        userId: new ObjectId().toString(),
        workspaceId: new ObjectId(),
        plan,
      });

      expect(usage).toMatchObject({ _id: expect.any(ObjectId) });
    });

    it('should map duplicate usage creation to limit exceeded error', async () => {
      const plan = createPlan({ monthlyCharge: 1000 });
      const promoCode = createPromoCode({
        type: 'fixed_price',
        amount: 100,
      });
      const service = new PromoCodeService({
        promoCodesFactory: {
          findOne: jest.fn().mockResolvedValue(promoCode),
        },
        promoCodeUsagesFactory: {
          countByPromoCodeId: jest.fn().mockResolvedValue(0),
          findByPromoCodeAndUser: jest.fn().mockResolvedValue(null),
          findByPromoCodeAndWorkspace: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockRejectedValue({ code: 11000 }),
        },
        plansFactory: {
          findById: jest.fn().mockResolvedValue(plan),
        },
      } as any);

      await expectPromoError(
        service.createUsage({
          promoCodeId: promoCode._id.toString(),
          userId: new ObjectId().toString(),
          workspaceId: new ObjectId(),
          plan,
        }),
        PromoCodeErrorCode.LimitExceeded
      );
    });

    it('should reject second createUsage when insert returns duplicate key', async () => {
      const plan = createPlan({ monthlyCharge: 1000 });
      const promoCode = createPromoCode({
        type: 'fixed_price',
        amount: 100,
      });
      const create = jest.fn()
        .mockResolvedValueOnce({ _id: new ObjectId() })
        .mockRejectedValueOnce({ code: 11000 });
      const service = new PromoCodeService({
        promoCodesFactory: {
          findOne: jest.fn().mockResolvedValue(promoCode),
        },
        promoCodeUsagesFactory: {
          countByPromoCodeId: jest.fn().mockResolvedValue(0),
          findByPromoCodeAndUser: jest.fn().mockResolvedValue(null),
          findByPromoCodeAndWorkspace: jest.fn().mockResolvedValue(null),
          create,
        },
        plansFactory: {
          findById: jest.fn().mockResolvedValue(plan),
        },
      } as any);
      const usageParams = {
        promoCodeId: promoCode._id.toString(),
        userId: new ObjectId().toString(),
        workspaceId: new ObjectId(),
        plan,
      };

      await service.createUsage(usageParams);

      await expectPromoError(service.createUsage(usageParams), PromoCodeErrorCode.LimitExceeded);
      expect(create).toHaveBeenCalledTimes(2);
    });
  });
});
