import type { Db } from 'mongodb';
import { MongoClient, MongoServerError, ObjectId } from 'mongodb';
import { validatePromoPayment } from '../../../src/billing/promoCodes/redemptions';
import PromoCodesFactory from '../../../src/models/promoCodesFactory';
import PromoCodeRedemptionsFactory from '../../../src/models/promoCodeRedemptionsFactory';
import type { PromoCodeInput, PromoPayment, PromoCodeRedemption } from '../../../src/billing/promoCodes/redemptions';
import type { PromoCode } from '../../../src/billing/promoCodes';
import migration from '../../../migrations/20261013000000-create-promo-code-collections';

describe('Promo code factories and successful usage', () => {
  const findPromoCode = jest.fn();
  const findRedemption = jest.fn();
  const countDocuments = jest.fn();
  const insertOne = jest.fn();
  const collection = jest.fn();
  const db = { collection } as unknown as Db;
  let promoCode: PromoCode;
  let input: PromoCodeInput;
  let payment: PromoPayment;
  let existingUse: PromoCodeRedemption;
  let promoCodesFactory: PromoCodesFactory;
  let redemptionsFactory: PromoCodeRedemptionsFactory;

  beforeEach(() => {
    jest.resetAllMocks();
    promoCode = {
      _id: new ObjectId(),
      code: 'SALE20',
      discount: {
        type: 'percent',
        value: 20,
      },
    };
    input = {
      promoCode: ' sale20 ',
      userId: new ObjectId(),
      workspaceId: new ObjectId(),
      tariffPlanId: new ObjectId(),
      originalAmount: 100,
    };
    payment = {
      promoCodeId: promoCode._id.toString(),
      userId: input.userId.toString(),
      workspaceId: input.workspaceId.toString(),
      tariffPlanId: input.tariffPlanId.toString(),
      originalAmount: 100,
      finalAmount: 80,
      transactionId: 'payment-123',
      paidAmount: 80,
      currency: 'RUB',
    };
    existingUse = {
      _id: new ObjectId(),
      promoCodeId: promoCode._id,
      userId: input.userId,
      workspaceId: input.workspaceId,
      tariffPlanId: input.tariffPlanId,
      transactionId: payment.transactionId,
      originalAmount: 100,
      finalAmount: 80,
    };
    collection.mockImplementation((name: string) => {
      if (name === 'promoCodes') {
        return { findOne: findPromoCode };
      }

      return {
        findOne: findRedemption,
        countDocuments,
        insertOne,
      };
    });
    findPromoCode.mockResolvedValue(promoCode);
    findRedemption.mockResolvedValue(null);
    countDocuments.mockResolvedValue(0);
    insertOne.mockResolvedValue({ acknowledged: true });
    redemptionsFactory = new PromoCodeRedemptionsFactory(db);
    promoCodesFactory = new PromoCodesFactory(db, redemptionsFactory);
  });

  test('should calculate a quote with one normalized lookup and no usage writes', async () => {
    expect(await promoCodesFactory.calculatePromoQuote(input)).toEqual({
      promoCodeId: promoCode._id,
      originalAmount: 100,
      finalAmount: 80,
    });
    expect(collection).toHaveBeenCalledWith('promoCodes');
    expect(collection).toHaveBeenCalledWith('promoCodeRedemptions');
    expect(findPromoCode).toHaveBeenCalledTimes(1);
    expect(findPromoCode).toHaveBeenCalledWith({ code: 'SALE20' });
    expect(findRedemption).toHaveBeenCalledWith({
      promoCodeId: promoCode._id,
      $or: [ { userId: input.userId }, { workspaceId: input.workspaceId } ],
    });
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('should calculate fixed discounts', async () => {
    promoCode.discount = {
      type: 'fixed',
      value: 25.5,
    };
    expect(await promoCodesFactory.calculatePromoQuote(input)).toMatchObject({ finalAmount: 75 });
  });

  test('should read legacy discountPercent without modifying the document', async () => {
    const legacy = {
      ...promoCode,
      discount: undefined,
      discountPercent: 20,
    };

    findPromoCode.mockResolvedValue(legacy);
    expect(await promoCodesFactory.calculatePromoQuote(input)).toMatchObject({ finalAmount: 80 });
    expect(legacy.discount).toBeUndefined();
  });

  test('should prefer the new discount over legacy discountPercent', async () => {
    findPromoCode.mockResolvedValue({
      ...promoCode,
      discountPercent: 50,
    });
    expect(await promoCodesFactory.calculatePromoQuote(input)).toMatchObject({ finalAmount: 80 });
  });

  test.each([null, {
    type: 'percent',
    value: 29.1,
  }, {
    type: 'fixed',
    value: -1,
  } ])(
    'should not fall back to a legacy value for invalid new discount %j', async discount => {
      findPromoCode.mockResolvedValue({
        ...promoCode,
        discount,
        discountPercent: 20,
      });
      await expect(promoCodesFactory.calculatePromoQuote(input)).rejects.toThrow('PROMO_CODE_INVALID');
    }
  );

  test.each([undefined, '20', 29.1])('should reject missing or invalid legacy discount %j', async discountPercent => {
    findPromoCode.mockResolvedValue({
      ...promoCode,
      discount: undefined,
      discountPercent,
    });
    await expect(promoCodesFactory.calculatePromoQuote(input)).rejects.toThrow('PROMO_CODE_INVALID');
  });

  test('should allow repeated quotes while no successful use exists', async () => {
    const first = await promoCodesFactory.calculatePromoQuote(input);

    expect(await promoCodesFactory.calculatePromoQuote(input)).toEqual(first);
    expect(insertOne).not.toHaveBeenCalled();
  });

  test.each(['userId', 'workspaceId'] as const)('should reject reuse by the same %s', async field => {
    const otherField = field === 'userId' ? 'workspaceId' : 'userId';

    existingUse[otherField] = new ObjectId();
    findRedemption.mockResolvedValue(existingUse);
    await expect(promoCodesFactory.calculatePromoQuote(input)).rejects.toThrow('PROMO_CODE_ALREADY_USED');
    await expect(promoCodesFactory.ensurePaymentAvailable(payment)).rejects.toThrow('PROMO_CODE_ALREADY_USED');
    expect(insertOne).not.toHaveBeenCalled();
  });

  test.each([0, 1])('should reject an exhausted limit of %j', async maxUses => {
    promoCode.maxUses = maxUses;
    countDocuments.mockResolvedValue(maxUses);
    await expect(promoCodesFactory.calculatePromoQuote(input)).rejects.toThrow('PROMO_CODE_INVALID');
    await expect(promoCodesFactory.ensurePaymentAvailable(payment)).rejects.toThrow('PROMO_CODE_INVALID');
    expect(countDocuments).toHaveBeenCalledWith({ promoCodeId: promoCode._id });
  });

  test.each([undefined, -1, '2'])('should ignore invalid or missing limit %j', async maxUses => {
    findPromoCode.mockResolvedValue({
      ...promoCode,
      maxUses,
    });
    expect(await promoCodesFactory.calculatePromoQuote(input)).toMatchObject({ finalAmount: 80 });
    expect(countDocuments).not.toHaveBeenCalled();
  });

  test.each(['missing', 'disabled', 'wrong-plan'])('should reject %s codes for quotes and checks', async reason => {
    if (reason === 'missing') {
      findPromoCode.mockResolvedValue(null);
    } else if (reason === 'disabled') {
      promoCode.isDisabled = true;
    } else {
      promoCode.planIds = [ new ObjectId() ];
    }

    await expect(promoCodesFactory.calculatePromoQuote(input)).rejects.toThrow('PROMO_CODE_INVALID');
    await expect(promoCodesFactory.ensurePaymentAvailable(payment)).rejects.toThrow('PROMO_CODE_INVALID');
    expect(findRedemption).not.toHaveBeenCalled();
  });

  test('should check payment availability with one ID lookup and without recomputing discount', async () => {
    promoCode.discount = {
      type: 'fixed',
      value: 90,
    };
    await expect(promoCodesFactory.ensurePaymentAvailable(payment)).resolves.toBeUndefined();
    expect(findPromoCode).toHaveBeenCalledTimes(1);
    expect(findPromoCode).toHaveBeenCalledWith({ _id: promoCode._id });
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('should allow the same successful payment retry even at the usage limit', async () => {
    promoCode.maxUses = 1;
    findRedemption.mockResolvedValue(existingUse);
    countDocuments.mockResolvedValue(1);
    await expect(promoCodesFactory.ensurePaymentAvailable(payment)).resolves.toBeUndefined();
    expect(countDocuments).not.toHaveBeenCalled();
  });

  test('should reject a different transaction using the same identities', async () => {
    existingUse.transactionId = 'another-payment';
    findRedemption.mockResolvedValue(existingUse);
    await expect(promoCodesFactory.ensurePaymentAvailable(payment)).rejects.toThrow('PROMO_CODE_ALREADY_USED');
  });

  test('maxUses is soft: parallel checked payments may exceed it and both successes must be recorded', async () => {
    promoCode.maxUses = 1;
    const otherPayment = {
      ...payment,
      userId: new ObjectId().toString(),
      workspaceId: new ObjectId().toString(),
      transactionId: 'parallel-payment',
    };

    await Promise.all([
      promoCodesFactory.ensurePaymentAvailable(payment),
      promoCodesFactory.ensurePaymentAvailable(otherPayment),
    ]);
    countDocuments.mockResolvedValue(1);
    await Promise.all([redemptionsFactory.redeem(payment), redemptionsFactory.redeem(otherPayment)]);
    expect(insertOne).toHaveBeenCalledTimes(2);
    expect(countDocuments).toHaveBeenCalledTimes(2);
    expect(findPromoCode).toHaveBeenCalledTimes(2);
  });

  test('should record only successful usage without status, expiry, discount or attempt fields', async () => {
    await redemptionsFactory.redeem(payment);
    expect(insertOne).toHaveBeenCalledWith({
      ...existingUse,
      _id: expect.any(ObjectId),
    });
    expect(findPromoCode).not.toHaveBeenCalled();
    expect(countDocuments).not.toHaveBeenCalled();
  });

  test('should tolerate the unique-index conflict on a successful callback retry', async () => {
    findRedemption.mockResolvedValue(existingUse);
    insertOne.mockRejectedValue(new MongoServerError({
      code: 11000,
      message: 'Duplicate key',
    }));
    await expect(redemptionsFactory.redeem(payment)).resolves.toBeUndefined();
    expect(findRedemption).toHaveBeenCalledWith({
      promoCodeId: promoCode._id,
      $or: [ { userId: input.userId }, { workspaceId: input.workspaceId } ],
    });
  });

  test.each(['userId', 'workspaceId'] as const)('should not block fulfillment of a parallel success sharing %s', async field => {
    const otherField = field === 'userId' ? 'workspaceId' : 'userId';

    existingUse[otherField] = new ObjectId();
    existingUse.transactionId = 'another-payment';
    findRedemption.mockResolvedValue(existingUse);
    insertOne.mockRejectedValue(new MongoServerError({
      code: 11000,
      message: 'Duplicate key',
    }));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      await expect(redemptionsFactory.redeem(payment)).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith('Promo code was used by a parallel successful payment', payment.transactionId);
    } finally {
      warn.mockRestore();
    }
  });

  test.each([
    new Error('Database unavailable'),
    new MongoServerError({
      code: 11000,
      message: 'Unrelated duplicate key',
    }),
    new MongoServerError({
      code: 123,
      message: 'Other MongoDB failure',
    }),
  ])('should propagate a database failure without a matching usage: %s', async error => {
    insertOne.mockRejectedValue(error);
    await expect(redemptionsFactory.redeem(payment)).rejects.toBe(error);
  });

  test('should accept the signed snapshot without needing discount data or an attempt ID', () => {
    payment.finalAmount = 37;
    payment.paidAmount = 37;
    expect(() => validatePromoPayment(payment)).not.toThrow();
  });

  test('should allow the rounded one-ruble floor for a sub-ruble original price', () => {
    payment.originalAmount = 0.5;
    payment.finalAmount = 1;
    payment.paidAmount = 1;
    expect(() => validatePromoPayment(payment)).not.toThrow();
  });

  test.each([1, 81, NaN, Infinity, '80'])('should reject changed paid amount %j before DB access', async paidAmount => {
    payment.paidAmount = paidAmount as number;
    expect(() => validatePromoPayment(payment)).toThrow('PROMO_CODE_WRONG_AMOUNT');
    await expect(promoCodesFactory.ensurePaymentAvailable(payment)).rejects.toThrow('PROMO_CODE_WRONG_AMOUNT');
    await expect(redemptionsFactory.redeem(payment)).rejects.toThrow('PROMO_CODE_WRONG_AMOUNT');
    expect(findPromoCode).not.toHaveBeenCalled();
    expect(insertOne).not.toHaveBeenCalled();
  });

  test.each([0, -1, 80.5, 101, NaN, Infinity])('should reject invalid signed final amount %j even if paid', finalAmount => {
    payment.finalAmount = finalAmount;
    payment.paidAmount = finalAmount;
    expect(() => validatePromoPayment(payment)).toThrow('PROMO_CODE_WRONG_AMOUNT');
  });

  test.each([0, -1, NaN, Infinity, '100'])('should reject invalid original amount %j', originalAmount => {
    payment.originalAmount = originalAmount as number;
    expect(() => validatePromoPayment(payment)).toThrow('PROMO_CODE_WRONG_AMOUNT');
  });

  test.each(['promoCodeId', 'userId', 'workspaceId', 'tariffPlanId'] as const)('should reject invalid %s', field => {
    payment[field] = 'not-an-object-id';
    expect(() => validatePromoPayment(payment)).toThrow('PROMO_CODE_INVALID_PAYMENT');
  });

  test.each(['', ' ', undefined, 123])('should reject invalid transaction ID %j', transactionId => {
    payment.transactionId = transactionId as string;
    expect(() => validatePromoPayment(payment)).toThrow('PROMO_CODE_INVALID_PAYMENT');
  });

  test.each(['USD', 'rub', '', undefined])('should reject currency %j', currency => {
    payment.currency = currency as string;
    expect(() => validatePromoPayment(payment)).toThrow('PROMO_CODE_INVALID_PAYMENT');
  });
});

describe('Promo factories with MongoDB unique indexes', () => {
  let client: MongoClient;
  let db: Db;
  let promoCodesFactory: PromoCodesFactory;
  let redemptionsFactory: PromoCodeRedemptionsFactory;
  let payment: PromoPayment;

  beforeAll(async () => {
    const globals = global as unknown as { __MONGO_URI__?: string };
    const uri = process.env.MONGO_URL || globals.__MONGO_URI__;

    if (!uri) {
      throw new Error('Jest MongoDB test URI is not configured');
    }

    client = new MongoClient(uri);
    await client.connect();
    db = client.db('promo-factory-tests-' + new ObjectId().toHexString());
    await migration.up(db);
    redemptionsFactory = new PromoCodeRedemptionsFactory(db);
    promoCodesFactory = new PromoCodesFactory(db, redemptionsFactory);
  });

  beforeEach(async () => {
    await db.collection('promoCodes').deleteMany({});
    await db.collection('promoCodeRedemptions').deleteMany({});
    const promoCodeId = new ObjectId();

    await db.collection('promoCodes').insertOne({
      _id: promoCodeId,
      code: 'SALE20',
      discount: {
        type: 'percent',
        value: 20,
      },
      maxUses: 1,
    });
    payment = {
      promoCodeId: promoCodeId.toHexString(),
      originalAmount: 100,
      finalAmount: 80,
      userId: new ObjectId().toHexString(),
      workspaceId: new ObjectId().toHexString(),
      tariffPlanId: new ObjectId().toHexString(),
      transactionId: 'successful-payment',
      paidAmount: 80,
      currency: 'RUB',
    };
  });

  afterAll(async () => {
    try {
      await db?.dropDatabase();
    } finally {
      await client?.close();
    }
  });

  test('should enforce uniqueness of code while allowing different codes', async () => {
    const promoCodes = db.collection('promoCodes');

    await promoCodes.insertOne({ code: 'OTHER' });
    await expect(promoCodes.insertOne({ code: 'SALE20' })).rejects.toMatchObject({ code: 11000 });
    await expect(promoCodesFactory.calculatePromoQuote({
      promoCode: ' sale20 ',
      userId: new ObjectId(payment.userId),
      workspaceId: new ObjectId(payment.workspaceId),
      tariffPlanId: new ObjectId(payment.tariffPlanId),
      originalAmount: 100,
    })).resolves.toMatchObject({ finalAmount: 80 });
  });

  test('concurrent callback retries should persist exactly one usage', async () => {
    await Promise.all([redemptionsFactory.redeem(payment), redemptionsFactory.redeem(payment)]);
    expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(1);
    await expect(promoCodesFactory.ensurePaymentAvailable(payment)).resolves.toBeUndefined();
  });

  test.each(['userId', 'workspaceId'] as const)('parallel successes sharing %s should keep one usage without rejecting fulfillment', async field => {
    const otherField = field === 'userId' ? 'workspaceId' : 'userId';
    const otherPayment = {
      ...payment,
      [otherField]: new ObjectId().toHexString(),
      transactionId: 'parallel-payment',
    };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      await Promise.all([
        promoCodesFactory.ensurePaymentAvailable(payment),
        promoCodesFactory.ensurePaymentAvailable(otherPayment),
      ]);
      await Promise.all([redemptionsFactory.redeem(payment), redemptionsFactory.redeem(otherPayment)]);
      expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(1);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  test('parallel successes with distinct identities may exceed maxUses, then block new payments', async () => {
    const otherPayment = {
      ...payment,
      userId: new ObjectId().toHexString(),
      workspaceId: new ObjectId().toHexString(),
      transactionId: 'parallel-payment',
    };

    await Promise.all([
      promoCodesFactory.ensurePaymentAvailable(payment),
      promoCodesFactory.ensurePaymentAvailable(otherPayment),
    ]);
    await Promise.all([redemptionsFactory.redeem(payment), redemptionsFactory.redeem(otherPayment)]);
    expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(2);
    await expect(promoCodesFactory.ensurePaymentAvailable({
      ...payment,
      userId: new ObjectId().toHexString(),
      workspaceId: new ObjectId().toHexString(),
      transactionId: 'later-payment',
    })).rejects.toThrow('PROMO_CODE_INVALID');
  });
});
