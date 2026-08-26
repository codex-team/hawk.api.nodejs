import { ObjectId } from 'mongodb';
import { PromoCodeBenefitType } from '@hawk.so/types';
import PlanModel from '../models/plan';
import PromoCodeModel from '../models/promoCode';
import PromoCodeUsageModel from '../models/promoCodeUsage';
import { ContextFactories } from '../types/graphql';
import type { Utm } from '@hawk.so/types';
import type { PaymentPromoData } from '../billing/types/paymentData';
import {
  calculatePromoCodePlanPrice
} from '../utils/promoCodePricing';
import { sanitizeUtmParams } from '../utils/utm/utm';

const PROMO_CODE_REGEXP = /^[A-Z0-9_-]+$/;
const DEFAULT_MIN_FINAL_PRICE = 1;

/**
 * Public promo code errors returned to clients.
 */
export enum PromoCodeErrorCode {
  Invalid = 'PROMO_CODE_INVALID',
  LimitExceeded = 'PROMO_CODE_LIMIT_EXCEEDED',
  VerifyFailed = 'PROMO_CODE_VERIFY_FAILED',
}

/**
 * Promo code error with safe public code.
 */
export class PromoCodeError extends Error {
  /**
   * Public error code.
   */
  public readonly code: PromoCodeErrorCode;

  /**
   * Creates promo code error.
   *
   * @param code - public error code
   * @param message - internal message
   */
  constructor(code: PromoCodeErrorCode, message: string = code) {
    super(message);
    this.code = code;
  }
}

/**
 * Validated promo data for one selected plan.
 */
export interface PromoCodePricingResult {
  /**
   * Promo code model.
   */
  promoCode: PromoCodeModel;

  /**
   * Benefit type.
   */
  benefitType: PromoCodeBenefitType;

  /**
   * Plan price before promo.
   */
  originalAmount: number;

  /**
   * Plan price after promo.
   */
  finalAmount: number;

  /**
   * Actual discount in money.
   */
  discountAmount: number;
}

/**
 * Validated promo code data returned after verification.
 */
export interface PromoCodeVerifyResult {
  /**
   * Normalized promo value.
   */
  value: string;

  /**
   * Benefit type.
   */
  benefitType: PromoCodeBenefitType;

  /**
   * Discount percent for percent promo.
   */
  percent?: number;

  /**
   * Fixed price amount.
   */
  amount?: number;

  /**
   * Minimum final price after percent discount.
   */
  minFinalPrice?: number;

  /**
   * Plan ids this promo can be applied to.
   */
  applicablePlanIds?: string[];
}

/**
 * UTM data stored with promo code usage.
 */
export type PromoCodeUtm = Utm;

/**
 * Normalizes promo code value before DB lookup.
 *
 * @param value - raw promo code value
 * @returns normalized promo code value
 */
export function normalizePromoCodeValue(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Checks if promo value format is allowed.
 *
 * @param value - normalized promo code value
 * @returns whether value has allowed promo code format
 */
function isAllowedPromoValue(value: string): boolean {
  return Boolean(value) && PROMO_CODE_REGEXP.test(value);
}

function isSupportedPromoCodeBenefitType(type: PromoCodeBenefitType): boolean {
  return type === 'percent_discount' || type === 'fixed_price';
}

/**
 * Rejects benefit types that are defined in schema but not implemented yet.
 *
 * @param benefit - promo benefit
 */
function assertSupportedBenefitType(benefit: PromoCodeModel['benefit']): void {
  if (!isSupportedPromoCodeBenefitType(benefit.type)) {
    throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo benefit type is not supported');
  }
}

/**
 * Validates static benefit structure.
 *
 * @param benefit - promo benefit
 */
function validateBenefitStructure(benefit: PromoCodeModel['benefit']): void {
  switch (benefit.type) {
    case 'percent_discount':
      if (typeof benefit.percent !== 'number' || benefit.percent <= 0 || benefit.percent > 100) {
        throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Percent discount is invalid');
      }

      if (
        benefit.minFinalPrice !== undefined &&
        (typeof benefit.minFinalPrice !== 'number' ||
          !Number.isFinite(benefit.minFinalPrice) ||
          benefit.minFinalPrice < DEFAULT_MIN_FINAL_PRICE)
      ) {
        throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Minimum final price is invalid');
      }

      return;

    case 'fixed_price':
      if (typeof benefit.amount !== 'number' || benefit.amount < DEFAULT_MIN_FINAL_PRICE) {
        throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Fixed price is invalid');
      }

      return;

    default:
      if (!isSupportedPromoCodeBenefitType(benefit.type)) {
        throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo benefit type is not supported');
      }

      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Unknown benefit type');
  }
}

/**
 * Builds promo reference stored in payment checksum.
 *
 * @param promoCodeId - applied promo code id
 * @param utm - optional UTM data
 * @returns promo reference for payment checksum
 */
export function buildPaymentPromoData(promoCodeId: string, utm?: Utm): PaymentPromoData {
  const sanitizedUtm = sanitizeUtmParams(utm);

  return {
    id: promoCodeId,
    ...(sanitizedUtm ? { utm: sanitizedUtm } : {}),
  };
}

/**
 * Service with promo code validation and usage helpers.
 */
export default class PromoCodeService {
  /**
   * Factories used by promo code service.
   */
  private readonly factories: ContextFactories;

  /**
   * Creates promo code service.
   *
   * @param factories - context factories
   */
  constructor(factories: ContextFactories) {
    this.factories = factories;
  }

  /**
   * Finds and validates promo code against common limits.
   *
   * @param value - raw promo code value
   * @param userId - user id
   * @param workspaceId - workspace id
   */
  public async getValidPromoCode(value: string, userId: string, workspaceId: string): Promise<PromoCodeModel> {
    const normalizedValue = normalizePromoCodeValue(value);

    if (!isAllowedPromoValue(normalizedValue)) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo value format is invalid');
    }

    const promoCode = await this.factories.promoCodesFactory.findByValue(normalizedValue);

    if (!promoCode) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo code not found');
    }

    await this.validateLoadedPromoCode(promoCode, userId, workspaceId);

    return promoCode;
  }

  /**
   * Validates promo code by id for one selected plan and returns final price.
   *
   * @param promoCodeId - promo code id
   * @param userId - user id
   * @param workspaceId - workspace id
   * @param plan - selected plan
   */
  public async getPricingForPromoCodeId(
    promoCodeId: string,
    userId: string,
    workspaceId: string,
    plan: PlanModel
  ): Promise<PromoCodePricingResult> {
    if (!ObjectId.isValid(promoCodeId)) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo code id is invalid');
    }

    const promoCode = await this.factories.promoCodesFactory.findOne({ _id: new ObjectId(promoCodeId) });

    if (!promoCode) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo code not found');
    }

    await this.validateLoadedPromoCode(promoCode, userId, workspaceId);

    return this.buildPricingResult(promoCode, plan);
  }

  /**
   * Verifies promo code and returns benefit data for client-side price calculation.
   *
   * @param value - raw promo code value
   * @param userId - user id
   * @param workspaceId - workspace id
   */
  public async verifyPromoCode(value: string, userId: string, workspaceId: string): Promise<PromoCodeVerifyResult> {
    const promoCode = await this.getValidPromoCode(value, userId, workspaceId);
    const benefit = promoCode.benefit;

    const result: PromoCodeVerifyResult = {
      value: promoCode.value,
      benefitType: benefit.type,
    };

    if (benefit.type === 'percent_discount') {
      result.percent = benefit.percent;

      if (benefit.minFinalPrice !== undefined) {
        result.minFinalPrice = benefit.minFinalPrice;
      }
    }

    if (benefit.type === 'fixed_price') {
      result.amount = benefit.amount;
    }

    if (
      (benefit.type === 'percent_discount' || benefit.type === 'fixed_price') &&
      benefit.applicablePlanIds?.length
    ) {
      result.applicablePlanIds = benefit.applicablePlanIds.map((planId): string => planId.toString());
    }

    return result;
  }

  /**
   * Validates promo code for one selected plan and returns final price.
   *
   * @param value - raw promo code value
   * @param userId - user id
   * @param workspaceId - workspace id
   * @param plan - selected plan
   */
  public async getPricingForPlan(value: string, userId: string, workspaceId: string, plan: PlanModel): Promise<PromoCodePricingResult> {
    const promoCode = await this.getValidPromoCode(value, userId, workspaceId);

    return this.buildPricingResult(promoCode, plan);
  }

  /**
   * Creates usage after successful payment.
   *
   * Re-validates promo by id, resolves pricing for the selected plan, and stores usage.
   * Unique indexes on promoCodeId + userId/workspaceId enforce one usage per user/workspace.
   *
   * @param params - usage creation params
   * @returns created promo usage
   */
  public async createUsage(params: {
    promoCodeId: string;
    userId: string;
    workspaceId: ObjectId;
    plan: PlanModel;
    utm?: PromoCodeUtm;
  }): Promise<PromoCodeUsageModel> {
    const promoPricing = await this.getPricingForPromoCodeId(
      params.promoCodeId,
      params.userId,
      params.workspaceId.toString(),
      params.plan
    );

    const utm = sanitizeUtmParams(params.utm);

    try {
      return await this.factories.promoCodeUsagesFactory.create({
        promoCodeId: promoPricing.promoCode._id,
        userId: params.userId,
        workspaceId: params.workspaceId,
        planId: params.plan._id,
        benefitType: promoPricing.benefitType,
        originalAmount: promoPricing.originalAmount,
        finalAmount: promoPricing.finalAmount,
        discountAmount: promoPricing.discountAmount,
        appliedAt: new Date(),
        ...(utm ? { utm } : {}),
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new PromoCodeError(PromoCodeErrorCode.LimitExceeded, 'Promo usage already exists');
      }

      throw error;
    }
  }

  /**
   * Validates loaded promo code against limits and expiry.
   *
   * @param promoCode - promo code model
   * @param userId - user id
   * @param workspaceId - workspace id
   */
  private async validateLoadedPromoCode(
    promoCode: PromoCodeModel,
    userId: string,
    workspaceId: string
  ): Promise<void> {
    if (promoCode.expiresAt && new Date() > new Date(promoCode.expiresAt)) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo code expired');
    }

    assertSupportedBenefitType(promoCode.benefit);
    validateBenefitStructure(promoCode.benefit);
    await this.validateUsageLimits(promoCode, userId, new ObjectId(workspaceId));
  }

  /**
   * Builds pricing result for validated promo code and plan.
   *
   * @param promoCode - promo code model
   * @param plan - selected plan
   * @returns validated promo pricing for selected plan
   */
  private buildPricingResult(promoCode: PromoCodeModel, plan: PlanModel): PromoCodePricingResult {
    const benefit = promoCode.benefit;

    if (benefit.type !== 'percent_discount' && benefit.type !== 'fixed_price') {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo benefit type is not supported');
    }

    const price = calculatePromoCodePlanPrice(benefit, plan);

    if (!price.isApplicable) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo code is not applicable to selected plan');
    }

    return {
      promoCode,
      benefitType: promoCode.benefit.type,
      originalAmount: price.originalAmount,
      finalAmount: price.finalAmount,
      discountAmount: price.discountAmount,
    };
  }

  /**
   * Validates all usage limits.
   *
   * @param promoCode - promo code model
   * @param userId - user id
   * @param workspaceId - workspace id
   */
  private async validateUsageLimits(promoCode: PromoCodeModel, userId: string, workspaceId: ObjectId): Promise<void> {
    const [totalUses, userUsage, workspaceUsage] = await Promise.all([
      this.factories.promoCodeUsagesFactory.countByPromoCodeId(promoCode._id),
      this.factories.promoCodeUsagesFactory.findByPromoCodeAndUser(promoCode._id, userId),
      this.factories.promoCodeUsagesFactory.findByPromoCodeAndWorkspace(promoCode._id, workspaceId),
    ]);

    if (typeof promoCode.limit === 'number' && totalUses >= promoCode.limit) {
      throw new PromoCodeError(PromoCodeErrorCode.LimitExceeded, 'Promo total limit exceeded');
    }

    if (userUsage || workspaceUsage) {
      throw new PromoCodeError(PromoCodeErrorCode.LimitExceeded, 'Promo per user or workspace limit exceeded');
    }
  }
}
