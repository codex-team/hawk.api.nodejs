import { ObjectId } from 'mongodb';
import PromoCodeService, {
  PromoCodeErrorCode
} from '../../src/services/promoCodeService';

function createPlan(monthlyCharge = 1000) {
  return {
    _id: new ObjectId(),
    monthlyCharge,
    isHidden: false,
  };
}

function createPromo(overrides: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(),
    value: 'SAVE25',
    benefit: {
      type: 'percent_discount',
      percent: 25,
    },
    ...overrides,
  };
}

function createService(options: {
  promo?: ReturnType<typeof createPromo> | null;
  transactionUsage?: Record<string, unknown> | null;
  conflictingUsage?: Record<string, unknown> | null;
  usageCount?: number;
  insertOne?: jest.Mock;
  updateOne?: jest.Mock;
} = {}) {
  const promo = options.promo === undefined ? createPromo() : options.promo;
  const promoCodes = {
    findOne: jest.fn().mockResolvedValue(promo),
  };
  const usages = {
    findOne: jest.fn().mockImplementation((query) => {
      if (query.transactionId) {
        return Promise.resolve(options.transactionUsage ?? null);
      }

      if (query.$or) {
        return Promise.resolve(options.conflictingUsage ?? null);
      }

      return Promise.resolve(null);
    }),
    countDocuments: jest.fn().mockResolvedValue(options.usageCount ?? 0),
    insertOne: options.insertOne ?? jest.fn().mockResolvedValue({ insertedId: new ObjectId() }),
    updateOne: options.updateOne ?? jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  };
  const db = {
    collection: jest.fn((name: string) => name === 'promoCodes' ? promoCodes : usages),
  };

  return {
    service: new PromoCodeService(db as any),
    promo,
    promoCodes,
    usages,
  };
}

describe('PromoCodeService', () => {
  it('should normalize and calculate percent discount', async () => {
    // Arrange
    const { service, promo, promoCodes } = createService();
    const plan = createPlan();

    // Act
    const quote = await service.quote(
      ' save25 ',
      new ObjectId().toString(),
      new ObjectId(),
      plan
    );

    // Assert
    expect(quote).toMatchObject({
      promoCodeId: promo?._id,
      originalAmount: 1000,
      finalAmount: 750,
      discountAmount: 250,
    });
    expect(promoCodes.findOne).toHaveBeenCalledWith({ value: 'SAVE25' });
  });

  it('should calculate fixed price for an applicable plan', async () => {
    // Arrange
    const plan = createPlan();
    const promo = createPromo({
      benefit: {
        type: 'fixed_price',
        amount: 100,
        applicablePlanIds: [plan._id],
      },
    });
    const { service } = createService({ promo });

    // Act
    const quote = await service.quote(
      promo.value,
      new ObjectId().toString(),
      new ObjectId(),
      plan
    );

    // Assert
    expect(quote).toMatchObject({
      finalAmount: 100,
      discountAmount: 900,
    });
  });

  it.each([
    { benefit: { type: 'grant_plan' } },
    { benefit: { type: 'percent_discount', percent: Number.NaN } },
    { benefit: { type: 'fixed_price', amount: Number.POSITIVE_INFINITY } },
  ])('should reject invalid benefit %#', async ({ benefit }) => {
    // Arrange
    const { service } = createService({ promo: createPromo({ benefit }) });

    // Act
    const promise = service.quote(
      'SAVE25',
      new ObjectId().toString(),
      new ObjectId(),
      createPlan()
    );

    // Assert
    await expect(promise).rejects.toMatchObject({
      code: PromoCodeErrorCode.Invalid,
    });
  });

  it('should reject an expired promo code', async () => {
    // Arrange
    const expired = createPromo({ expiresAt: new Date(Date.now() - 1000) });
    const { service } = createService({ promo: expired });

    // Act
    const promise = service.quote(
      expired.value,
      new ObjectId().toString(),
      new ObjectId(),
      createPlan()
    );

    // Assert
    await expect(promise).rejects.toMatchObject({
      code: PromoCodeErrorCode.Invalid,
    });
  });

  it('should reject an already used promo code', async () => {
    // Arrange
    const used = createService({
      conflictingUsage: { _id: new ObjectId() },
    });

    // Act
    const promise = used.service.quote(
      'SAVE25',
      new ObjectId().toString(),
      new ObjectId(),
      createPlan()
    );

    // Assert
    await expect(promise).rejects.toMatchObject({
      code: PromoCodeErrorCode.LimitExceeded,
    });
  });

  it('should delete expired reservations before checking availability', async () => {
    // Arrange
    const { service, usages } = createService();

    // Act
    await service.quote(
      'SAVE25',
      new ObjectId().toString(),
      new ObjectId(),
      createPlan()
    );

    // Assert
    expect(usages.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      status: 'reserved',
      reservationExpiresAt: {
        $lte: expect.any(Date),
      },
    }));
  });

  it('should create a reservation with a pricing snapshot', async () => {
    // Arrange
    const { service, promo, usages } = createService();
    const plan = createPlan();

    // Act
    const reservation = await service.reserve({
      transactionId: 'tx-1',
      promoCodeId: promo?._id.toString() as string,
      userId: 'user-1',
      workspaceId: new ObjectId(),
      plan,
      utm: { source: 'test' },
    });

    // Assert
    expect(reservation).toMatchObject({
      created: true,
      finalAmount: 750,
    });
    expect(usages.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: 'tx-1',
      status: 'reserved',
      finalAmount: 750,
      utm: { source: 'test' },
    }));
  });

  it('should return the existing reservation for the same transaction', async () => {
    // Arrange
    const plan = createPlan();
    const promo = createPromo();
    const workspaceId = new ObjectId();
    const transactionUsage = {
      _id: new ObjectId(),
      transactionId: 'tx-2',
      promoCodeId: promo._id,
      userId: 'user-2',
      workspaceId,
      planId: plan._id,
      benefitType: 'percent_discount',
      originalAmount: 1000,
      finalAmount: 750,
      discountAmount: 250,
      status: 'reserved',
    };
    const { service, usages } = createService({ promo, transactionUsage });

    // Act
    const reservation = await service.reserve({
      transactionId: 'tx-2',
      promoCodeId: promo._id.toString(),
      userId: 'user-2',
      workspaceId,
      plan,
    });

    // Assert
    expect(reservation).toMatchObject({
      created: false,
      finalAmount: 750,
    });
    expect(usages.insertOne).not.toHaveBeenCalled();
  });

  it('should retry another ordinal after a concurrent reservation', async () => {
    // Arrange
    const promo = createPromo({ limit: 2 });
    const insertOne = jest.fn()
      .mockRejectedValueOnce({ code: 11000 })
      .mockResolvedValueOnce({ insertedId: new ObjectId() });
    const { service, usages } = createService({ promo, insertOne });
    const plan = createPlan();
    const lastOrdinals = [-1, 0];

    usages.countDocuments
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    usages.findOne.mockImplementation((query) => {
      if (query.ordinal) {
        const ordinal = lastOrdinals.shift();

        return Promise.resolve(ordinal === undefined || ordinal < 0 ? null : { ordinal });
      }

      return Promise.resolve(null);
    });

    // Act
    const reservation = await service.reserve({
      transactionId: 'tx-3',
      promoCodeId: promo._id.toString(),
      userId: 'user-3',
      workspaceId: new ObjectId(),
      plan,
    });

    // Assert
    expect(reservation).toMatchObject({
      created: true,
    });
    expect(insertOne).toHaveBeenNthCalledWith(1, expect.objectContaining({ ordinal: 0 }));
    expect(insertOne).toHaveBeenNthCalledWith(2, expect.objectContaining({ ordinal: 1 }));
  });

  it('should finalize a reserved usage', async () => {
    // Arrange
    const reservedUsage = {
      _id: new ObjectId(),
      transactionId: 'tx-4',
      status: 'reserved',
    };
    const { service, usages } = createService({ transactionUsage: reservedUsage });

    // Act
    await service.finalize('tx-4');

    // Assert
    expect(usages.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'reserved' }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'applied' }),
        $unset: { reservationExpiresAt: '' },
      })
    );
  });

  it('should release only a reserved usage', async () => {
    // Arrange
    const { service, usages } = createService();

    // Act
    await service.release('tx-4');

    // Assert
    expect(usages.deleteOne).toHaveBeenCalledWith({
      transactionId: 'tx-4',
      status: 'reserved',
    });
  });

  it('should finalize an applied usage idempotently', async () => {
    // Arrange
    const reservedUsage = {
      _id: new ObjectId(),
      transactionId: 'tx-4',
      status: 'reserved',
    };
    const applied = createService({
      transactionUsage: {
        ...reservedUsage,
        status: 'applied',
      },
    });

    // Act
    await applied.service.finalize('tx-4');

    // Assert
    expect(applied.usages.updateOne).not.toHaveBeenCalled();
  });
});
