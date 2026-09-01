import { Collection, Db, ObjectId } from 'mongodb';

const PROMO_CODE_REGEXP = /^[A-Z0-9_-]+$/;
const MIN_PRICE = 1;
const RESERVATION_TTL_MS = 30 * 60 * 1000;

interface PromoBenefit {
  type: string;
  percent?: number;
  amount?: number;
  minFinalPrice?: number;
  applicablePlanIds?: ObjectId[];
}

interface PromoCodeDocument {
  _id: ObjectId;
  value: string;
  benefit: PromoBenefit;
  limit?: number;
  expiresAt?: Date;
}

interface PromoUsageDocument {
  _id: ObjectId;
  transactionId: string;
  promoCodeId: ObjectId;
  userId: string;
  workspaceId: ObjectId;
  planId: ObjectId;
  benefitType: string;
  originalAmount: number;
  finalAmount: number;
  discountAmount: number;
  status: 'reserved' | 'applied';
  ordinal?: number;
  reservationExpiresAt?: Date;
  appliedAt?: Date;
  utm?: Record<string, string>;
}

interface PromoPlan {
  _id: ObjectId;
  monthlyCharge: number;
  isHidden?: boolean;
}

export enum PromoCodeErrorCode {
  Invalid = 'PROMO_CODE_INVALID',
  LimitExceeded = 'PROMO_CODE_LIMIT_EXCEEDED',
}

export class PromoCodeError extends Error {
  constructor(public readonly code: PromoCodeErrorCode, message: string) {
    super(message);
  }
}

export interface PromoQuote {
  promoCodeId: ObjectId;
  benefitType: 'percent_discount' | 'fixed_price';
  originalAmount: number;
  finalAmount: number;
  discountAmount: number;
}

export interface PromoReservation extends PromoQuote {
  created: boolean;
}

export interface PromoCodeContext {
  promoCodeService: PromoCodeService;
}

export default class PromoCodeService {
  private readonly promoCodes: Collection<PromoCodeDocument>;
  private readonly usages: Collection<PromoUsageDocument>;

  constructor(db: Db) {
    this.promoCodes = db.collection<PromoCodeDocument>('promoCodes');
    this.usages = db.collection<PromoUsageDocument>('promoCodeUsages');
  }

  public async quote(value: string, userId: string, workspaceId: ObjectId, plan: PromoPlan): Promise<PromoQuote> {
    const normalizedValue = value.trim().toUpperCase();

    if (!PROMO_CODE_REGEXP.test(normalizedValue)) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Invalid promo code');
    }

    const promoCode = await this.promoCodes.findOne({ value: normalizedValue });

    if (!promoCode) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo code not found');
    }

    await this.deleteExpiredReservations(promoCode._id);
    await this.assertAvailable(promoCode, userId, workspaceId);

    return this.calculateQuote(promoCode, plan);
  }

  public async reserve(params: {
    transactionId: string;
    promoCodeId: string;
    userId: string;
    workspaceId: ObjectId;
    plan: PromoPlan;
    utm?: Record<string, string>;
  }): Promise<PromoReservation> {
    if (!ObjectId.isValid(params.promoCodeId)) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Invalid promo code id');
    }

    const promoCodeId = new ObjectId(params.promoCodeId);

    await this.deleteExpiredReservations(promoCodeId);

    const existingUsage = await this.usages.findOne({ transactionId: params.transactionId });

    if (existingUsage) {
      return this.toReservation(this.assertSameTransaction(existingUsage, params), false);
    }

    const promoCode = await this.promoCodes.findOne({ _id: promoCodeId });

    if (!promoCode) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo code not found');
    }

    await this.assertAvailable(promoCode, params.userId, params.workspaceId);

    const quote = this.calculateQuote(promoCode, params.plan);
    const usage = {
      _id: new ObjectId(),
      transactionId: params.transactionId,
      promoCodeId: quote.promoCodeId,
      userId: params.userId,
      workspaceId: params.workspaceId,
      planId: params.plan._id,
      benefitType: quote.benefitType,
      originalAmount: quote.originalAmount,
      finalAmount: quote.finalAmount,
      discountAmount: quote.discountAmount,
      status: 'reserved' as const,
      reservationExpiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
      ...(params.utm && Object.keys(params.utm).length > 0 ? { utm: params.utm } : {}),
    };

    while (true) {
      let ordinal: number | undefined;

      if (typeof promoCode.limit === 'number') {
        const [count, lastUsage] = await Promise.all([
          this.usages.countDocuments({ promoCodeId: promoCode._id }),
          this.usages.findOne(
            {
              promoCodeId: promoCode._id,
              ordinal: { $exists: true },
            },
            {
              sort: { ordinal: -1 },
              projection: { ordinal: 1 },
            }
          ),
        ]);

        if (count >= promoCode.limit) {
          throw new PromoCodeError(PromoCodeErrorCode.LimitExceeded, 'Promo code limit exceeded');
        }

        ordinal = (lastUsage?.ordinal ?? -1) + 1;
      }

      try {
        await this.usages.insertOne({
          ...usage,
          ...(ordinal !== undefined ? { ordinal } : {}),
        });

        return {
          ...quote,
          created: true,
        };
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) {
          throw error;
        }

        const transactionUsage = await this.usages.findOne({ transactionId: params.transactionId });

        if (transactionUsage) {
          return this.toReservation(this.assertSameTransaction(transactionUsage, params), false);
        }

        const conflictingUsage = await this.findUserOrWorkspaceUsage(
          promoCode._id,
          params.userId,
          params.workspaceId
        );

        if (conflictingUsage || ordinal === undefined) {
          throw new PromoCodeError(PromoCodeErrorCode.LimitExceeded, 'Promo code was already used');
        }
      }
    }
  }

  public async finalize(transactionId: string): Promise<void> {
    const usage = await this.usages.findOne({ transactionId });

    if (!usage) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo reservation not found');
    }

    if (usage.status === 'applied') {
      return;
    }

    const result = await this.usages.updateOne(
      {
        _id: usage._id,
        status: 'reserved',
      },
      {
        $set: {
          status: 'applied',
          appliedAt: new Date(),
        },
        $unset: { reservationExpiresAt: '' },
      }
    );

    if (result.modifiedCount !== 1) {
      const currentUsage = await this.usages.findOne({ transactionId });

      if (currentUsage?.status === 'applied') {
        return;
      }

      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo reservation was not finalized');
    }
  }

  public async release(transactionId: string): Promise<void> {
    await this.usages.deleteOne({
      transactionId,
      status: 'reserved',
    });
  }

  private async assertAvailable(promoCode: PromoCodeDocument, userId: string, workspaceId: ObjectId): Promise<void> {
    if (promoCode.expiresAt && promoCode.expiresAt.getTime() < Date.now()) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo code expired');
    }

    if (
      promoCode.limit !== undefined &&
      (!Number.isInteger(promoCode.limit) || promoCode.limit <= 0)
    ) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Invalid promo code limit');
    }

    const [conflictingUsage, usageCount] = await Promise.all([
      this.findUserOrWorkspaceUsage(promoCode._id, userId, workspaceId),
      typeof promoCode.limit === 'number'
        ? this.usages.countDocuments({ promoCodeId: promoCode._id })
        : Promise.resolve(0),
    ]);

    if (conflictingUsage || (typeof promoCode.limit === 'number' && usageCount >= promoCode.limit)) {
      throw new PromoCodeError(PromoCodeErrorCode.LimitExceeded, 'Promo code limit exceeded');
    }
  }

  private async findUserOrWorkspaceUsage(
    promoCodeId: ObjectId,
    userId: string,
    workspaceId: ObjectId
  ): Promise<PromoUsageDocument | null> {
    return this.usages.findOne({
      promoCodeId,
      $or: [
        { userId },
        { workspaceId },
      ],
    });
  }

  private async deleteExpiredReservations(promoCodeId: ObjectId): Promise<void> {
    await this.usages.deleteMany({
      promoCodeId,
      status: 'reserved',
      reservationExpiresAt: { $lte: new Date() },
    });
  }

  private calculateQuote(promoCode: PromoCodeDocument, plan: PromoPlan): PromoQuote {
    const benefit = promoCode.benefit;
    const applicablePlanIds = benefit.applicablePlanIds ?? [];
    const appliesToPlan = applicablePlanIds.length === 0 ||
      applicablePlanIds.some(planId => planId.toString() === plan._id.toString());

    if (plan.isHidden || plan.monthlyCharge <= 0 || !appliesToPlan) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo code is not applicable to this plan');
    }

    let finalAmount: number;

    if (benefit.type === 'percent_discount') {
      if (
        !Number.isFinite(benefit.percent) ||
        benefit.percent === undefined ||
        benefit.percent <= 0 ||
        benefit.percent > 100 ||
        (
          benefit.minFinalPrice !== undefined &&
          (
            !Number.isInteger(benefit.minFinalPrice) ||
            benefit.minFinalPrice < MIN_PRICE
          )
        )
      ) {
        throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Invalid percent discount');
      }

      const discount = Math.floor(plan.monthlyCharge * benefit.percent / 100);

      finalAmount = Math.max(plan.monthlyCharge - discount, benefit.minFinalPrice ?? MIN_PRICE);
    } else if (benefit.type === 'fixed_price') {
      if (
        !Number.isInteger(benefit.amount) ||
        benefit.amount === undefined ||
        benefit.amount < MIN_PRICE
      ) {
        throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Invalid fixed price');
      }

      finalAmount = benefit.amount;
    } else {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Unsupported promo code');
    }

    if (finalAmount >= plan.monthlyCharge) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo code does not reduce the price');
    }

    return {
      promoCodeId: promoCode._id,
      benefitType: benefit.type,
      originalAmount: plan.monthlyCharge,
      finalAmount,
      discountAmount: plan.monthlyCharge - finalAmount,
    };
  }

  private assertSameTransaction(
    usage: PromoUsageDocument,
    params: {
      promoCodeId: string;
      userId: string;
      workspaceId: ObjectId;
      plan: PromoPlan;
    }
  ): PromoUsageDocument {
    if (
      usage.promoCodeId.toString() !== params.promoCodeId ||
      usage.userId !== params.userId ||
      usage.workspaceId.toString() !== params.workspaceId.toString() ||
      usage.planId.toString() !== params.plan._id.toString()
    ) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Transaction has another promo reservation');
    }

    return usage;
  }

  private toReservation(usage: PromoUsageDocument, created: boolean): PromoReservation {
    return {
      promoCodeId: usage.promoCodeId,
      benefitType: usage.benefitType as PromoQuote['benefitType'],
      originalAmount: usage.originalAmount,
      finalAmount: usage.finalAmount,
      discountAmount: usage.discountAmount,
      created,
    };
  }
}
