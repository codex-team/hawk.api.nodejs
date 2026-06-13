import { ObjectId } from 'mongodb';
import {
  PromoCodeBenefit,
  PromoCodeBenefitType
} from '@hawk.so/types';
import PlanModel from '../models/plan';
import PromoCodeModel from '../models/promoCode';
import WorkspaceModel from '../models/workspace';
import { ContextFactories } from '../types/graphql';
import type { Utm } from '@hawk.so/types';
import type { PaymentPromoData } from '../billing/types/paymentData';

const PROMO_CODE_REGEXP = /^[A-Z0-9_-]+$/;
const DEFAULT_MIN_FINAL_PRICE = 1;

/**
 * Public promo code errors returned to clients.
 */
export enum PromoCodeErrorCode {
  Invalid = 'PROMO_CODE_INVALID',
  LimitExceeded = 'PROMO_CODE_LIMIT_EXCEEDED',
  ApplyFailed = 'PROMO_CODE_APPLY_FAILED',
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
 * Price calculated for a plan after promo preview.
 */
export interface PromoCodePlanPrice {
  /**
   * Plan id.
   */
  planId: string;

  /**
   * Whether promo code can be applied to this plan.
   */
  isApplicable: boolean;

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
 * Promo preview result for all plans.
 */
export interface PromoCodePreviewResult {
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
   * Discount amount or fixed price amount.
   */
  amount?: number;

  /**
   * Calculated price for each visible plan.
   */
  plans: PromoCodePlanPrice[];
}

/**
 * UTM data stored with promo code usage.
 */
export type PromoCodeUtm = Utm;

/**
 * Normalizes promo code value before DB lookup.
 *
 * @param value - raw promo code value
 */
export function normalizePromoCodeValue(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Checks if promo value format is allowed.
 *
 * @param value - normalized promo code value
 */
function isAllowedPromoValue(value: string): boolean {
  return Boolean(value) && PROMO_CODE_REGEXP.test(value);
}

/**
 * Returns whether plan is available for purchase/apply.
 *
 * @param plan - tariff plan
 */
function isPlanAvailable(plan: PlanModel): boolean {
  return plan.isHidden !== true;
}

/**
 * Checks whether promo benefit is applicable to plan.
 *
 * @param benefit - promo benefit
 * @param plan - selected plan
 */
function isPlanApplicable(benefit: PromoCodeBenefit, plan: PlanModel): boolean {
  if (benefit.type === 'grant_plan') {
    return benefit.planId?.toString() === plan._id.toString();
  }

  if (!benefit.applicablePlanIds || benefit.applicablePlanIds.length === 0) {
    return true;
  }

  return benefit.applicablePlanIds.some((planId): boolean => planId.toString() === plan._id.toString());
}

/**
 * Returns whether discount promo can affect plan price.
 *
 * @param plan - tariff plan
 */
function isDiscountablePlan(plan: PlanModel): boolean {
  return plan.monthlyCharge > 0 && isPlanAvailable(plan);
}

/**
 * Calculates discounted price for one plan.
 *
 * @param benefit - promo benefit
 * @param plan - selected plan
 */
export function calculatePromoCodePlanPrice(benefit: PromoCodeBenefit, plan: PlanModel): PromoCodePlanPrice {
  const originalAmount = plan.monthlyCharge;
  const isApplicable = benefit.type !== 'grant_plan' &&
    isDiscountablePlan(plan) &&
    isPlanApplicable(benefit, plan);

  if (!isApplicable) {
    return {
      planId: plan._id.toString(),
      isApplicable: false,
      originalAmount,
      finalAmount: originalAmount,
      discountAmount: 0,
    };
  }

  switch (benefit.type) {
    case 'percent_discount': {
      const minFinalPrice = benefit.minFinalPrice ?? DEFAULT_MIN_FINAL_PRICE;
      const discountAmount = Math.floor(originalAmount * benefit.percent / 100);
      const finalAmount = Math.max(originalAmount - discountAmount, minFinalPrice);

      if (finalAmount >= originalAmount) {
        return {
          planId: plan._id.toString(),
          isApplicable: false,
          originalAmount,
          finalAmount: originalAmount,
          discountAmount: 0,
        };
      }

      return {
        planId: plan._id.toString(),
        isApplicable: true,
        originalAmount,
        finalAmount,
        discountAmount: originalAmount - finalAmount,
      };
    }

    case 'amount_discount': {
      const minFinalPrice = benefit.minFinalPrice ?? DEFAULT_MIN_FINAL_PRICE;
      const finalAmount = Math.max(originalAmount - benefit.amount, minFinalPrice);

      if (finalAmount >= originalAmount) {
        return {
          planId: plan._id.toString(),
          isApplicable: false,
          originalAmount,
          finalAmount: originalAmount,
          discountAmount: 0,
        };
      }

      return {
        planId: plan._id.toString(),
        isApplicable: true,
        originalAmount,
        finalAmount,
        discountAmount: originalAmount - finalAmount,
      };
    }

    case 'fixed_price':
      if (benefit.amount >= originalAmount) {
        return {
          planId: plan._id.toString(),
          isApplicable: false,
          originalAmount,
          finalAmount: originalAmount,
          discountAmount: 0,
        };
      }

      return {
        planId: plan._id.toString(),
        isApplicable: true,
        originalAmount,
        finalAmount: benefit.amount,
        discountAmount: originalAmount - benefit.amount,
      };

    default:
      return {
        planId: plan._id.toString(),
        isApplicable: false,
        originalAmount,
        finalAmount: originalAmount,
        discountAmount: 0,
      };
  }
}

/**
 * Validates static benefit structure.
 *
 * @param benefit - promo benefit
 */
function validateBenefitStructure(benefit: PromoCodeBenefit): void {
  switch (benefit?.type) {
    case 'grant_plan':
      if (!benefit.planId) {
        throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Grant plan id is missing');
      }

      return;

    case 'percent_discount':
      if (typeof benefit.percent !== 'number' || benefit.percent <= 0 || benefit.percent > 100) {
        throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Percent discount is invalid');
      }

      return;

    case 'amount_discount':
      if (typeof benefit.amount !== 'number' || benefit.amount <= 0) {
        throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Amount discount is invalid');
      }

      return;

    case 'fixed_price':
      if (typeof benefit.amount !== 'number' || benefit.amount < DEFAULT_MIN_FINAL_PRICE) {
        throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Fixed price is invalid');
      }

      return;

    default:
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Unknown benefit type');
  }
}

/**
 * Builds promo payload stored in payment checksum.
 *
 * @param pricing - validated promo pricing
 * @param utm - optional UTM data
 * @returns promo data for payment checksum
 */
export function buildPaymentPromoData(pricing: PromoCodePricingResult, utm?: Utm): PaymentPromoData {
  return {
    id: pricing.promoCode._id.toString(),
    benefitType: pricing.benefitType as PaymentPromoData['benefitType'],
    originalAmount: pricing.originalAmount,
    finalAmount: pricing.finalAmount,
    discountAmount: pricing.discountAmount,
    ...(utm && Object.keys(utm).length > 0 ? { utm } : {}),
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
   * Builds preview prices for visible plans.
   *
   * @param value - raw promo code value
   * @param userId - user id
   * @param workspaceId - workspace id
   */
  public async preview(value: string, userId: string, workspaceId: string): Promise<PromoCodePreviewResult> {
    const promoCode = await this.getValidPromoCode(value, userId, workspaceId);
    const benefit = promoCode.benefit;

    if (benefit.type === 'grant_plan') {
      const plan = await this.factories.plansFactory.findById(benefit.planId.toString());

      if (!plan || !isPlanAvailable(plan)) {
        throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Grant plan is unavailable');
      }

      return {
        value: promoCode.value,
        benefitType: benefit.type,
        plans: [],
      };
    }

    const plans = await this.factories.plansFactory.findAll();

    return {
      value: promoCode.value,
      benefitType: benefit.type,
      percent: benefit.type === 'percent_discount' ? benefit.percent : undefined,
      amount: benefit.type === 'amount_discount' || benefit.type === 'fixed_price' ? benefit.amount : undefined,
      plans: plans.map((plan): PromoCodePlanPrice => calculatePromoCodePlanPrice(benefit, plan)),
    };
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
   * Applies grant_plan promo code to workspace.
   *
   * @param value - raw promo code value
   * @param userId - user id
   * @param workspace - workspace model
   * @param utm - optional UTM data
   */
  public async applyGrantPlan(value: string, userId: string, workspace: WorkspaceModel, utm?: PromoCodeUtm): Promise<PlanModel> {
    const promoCode = await this.getValidPromoCode(value, userId, workspace._id.toString());

    if (promoCode.benefit.type !== 'grant_plan') {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Promo code is not grant_plan');
    }

    const plan = await this.factories.plansFactory.findById(promoCode.benefit.planId.toString());

    if (!plan || !isPlanAvailable(plan)) {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Grant plan is unavailable');
    }

    try {
      const now = new Date();

      await workspace.updatePlanHistory(workspace.tariffPlanId.toString(), now, userId);
      await workspace.updateLastChargeDate(now);
      await workspace.changePlan(plan._id);
      await this.createUsage({
        promoCode,
        userId,
        workspaceId: workspace._id,
        planId: plan._id,
        benefitType: promoCode.benefit.type,
        utm,
      });

      return plan;
    } catch (error) {
      if (error instanceof PromoCodeError) {
        throw error;
      }

      throw new PromoCodeError(PromoCodeErrorCode.ApplyFailed, 'Grant plan apply failed');
    }
  }

  /**
   * Creates usage after successful payment.
   *
   * @param params - usage creation params
   */
  public async createUsage(params: {
    promoCode: PromoCodeModel;
    userId: string;
    workspaceId: ObjectId;
    planId?: ObjectId;
    benefitType: PromoCodeBenefitType;
    originalAmount?: number;
    finalAmount?: number;
    discountAmount?: number;
    utm?: PromoCodeUtm;
  }): Promise<void> {
    await this.validateUsageLimits(params.promoCode, params.userId, params.workspaceId);

    try {
      await this.factories.promoCodeUsagesFactory.create({
        promoCodeId: params.promoCode._id,
        userId: params.userId,
        workspaceId: params.workspaceId,
        planId: params.planId,
        benefitType: params.benefitType,
        originalAmount: params.originalAmount,
        finalAmount: params.finalAmount,
        discountAmount: params.discountAmount,
        appliedAt: new Date(),
        ...(params.utm && Object.keys(params.utm).length > 0 ? { utm: params.utm } : {}),
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
    if (promoCode.benefit.type === 'grant_plan') {
      throw new PromoCodeError(PromoCodeErrorCode.Invalid, 'Grant plan promo cannot be used in payment');
    }

    const price = calculatePromoCodePlanPrice(promoCode.benefit, plan);

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
