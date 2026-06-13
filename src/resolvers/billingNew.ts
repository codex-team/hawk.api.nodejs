import BusinessOperationModel from '../models/businessOperation';
import { ResolverContextWithUser } from '../types/graphql';
import WorkspaceModel from '../models/workspace';
import UserModel from '../models/user';
import {
  BusinessOperationPayloadType,
  PayloadOfDepositByUser,
  PayloadOfWorkspacePlanPurchase
} from '@hawk.so/types';
import checksumService from '../utils/checksumService';
import { UserInputError } from 'apollo-server-express';
import cloudPaymentsApi, { CloudPaymentsJsonData } from '../utils/cloudPaymentsApi';
import * as telegram from '../utils/telegram';
import { TelegramBotURLs } from '../utils/telegram';
import PromoCodeService, { PromoCodeError, PromoCodeErrorCode, PromoCodePreviewResult, buildPaymentPromoData } from '../utils/promoCodeService';
import { publish } from '../rabbitmq';
import type { PaymentPromoData } from '../billing/types/paymentData';
import type { Utm } from '@hawk.so/types';
import { validateUtmParams } from '../utils/utm/utm';

/**
 * The amount we will debit to confirm the subscription.
 * After confirmation, we will refund the user money.
 */
const AMOUNT_FOR_CARD_VALIDATION = 1;

/**
 * Input data for composePayment query
 */
interface ComposePaymentArgs {
  input: {
    workspaceId: string;
    tariffPlanId: string;
    shouldSaveCard?: boolean;
    promoCode?: string;
    promoUtm?: Utm;
  };
}

/**
 * Input data for promo code preview/apply mutation.
 */
interface PreviewPromoCodeArgs {
  input: {
    workspaceId: string;
    value: string;
    utm?: Utm;
  };
}

/**
 * Converts internal promo errors to public GraphQL errors.
 *
 * @param error - error to convert
 */
function throwPromoCodeGraphQLError(error: unknown): never {
  if (error instanceof PromoCodeError) {
    throw new UserInputError(error.code);
  }

  throw new UserInputError(PromoCodeErrorCode.ApplyFailed);
}

/**
 * Data for processing payment with saved card
 */
interface PayWithCardArgs {
  /**
   * Input data
   */
  input: {
    /**
     * Checksum for payment validation
     */
    checksum: string;

    /**
     * Card id for processing payments
     */
    cardId: string;

    /**
     * Is payment recurrent or not. If payment is recurrent, then the money will be debited every month
     */
    isRecurrent?: boolean;
  };
}

export default {
  Query: {
    /**
     * API Query method for getting all transactions for passed workspaces
     * @param _obj - parent object
     * @param ids - ids of workspaces for which transactions have been requested
     * @param user - current authorized user
     * @param factories - factories for working with models
     */
    async businessOperations(
      _obj: undefined,
      { ids }: { ids: string[] },
      { user, factories }: ResolverContextWithUser
    ): Promise<BusinessOperationModel[]> {
      return factories.businessOperationsFactory.getWorkspacesBusinessOperations(ids);
    },

    /**
     * GraphQL version of composePayment: prepares data before charge
     */
    async composePayment(
      _obj: undefined,
      { input }: ComposePaymentArgs,
      { user, factories }: ResolverContextWithUser
    ): Promise<{
      invoiceId: string;
      plan: { id: string; name: string; monthlyCharge: number };
      isCardLinkOperation: boolean;
      currency: string;
      checksum: string;
      nextPaymentDate: Date;
      cloudPaymentsPublicId: string;
      promo?: PaymentPromoData;
    }> {
      const { workspaceId, tariffPlanId, shouldSaveCard, promoCode } = input;
      const promoUtm = validateUtmParams(input.promoUtm);

      if (!workspaceId || !tariffPlanId || !user?.id) {
        throw new UserInputError('No workspaceId, tariffPlanId or user id provided');
      }

      const workspace = await factories.workspacesFactory.findById(workspaceId);
      const plan = await factories.plansFactory.findById(tariffPlanId);

      if (!workspace || !plan) {
        throw new UserInputError("Can't get workspace or plan by provided ids");
      }

      const member = await workspace.getMemberInfo(user.id);

      if (!member) {
        throw new UserInputError('User is not a member of the workspace');
      }

      const now = new Date();
      const invoiceId = `${workspace.name} ${now.getDate()}/${now.getMonth() + 1} ${plan.name}`;

      let isCardLinkOperation = false;

      /**
       * We need to only link card and not pay for the whole plan in case
       * 1. We are paying for the same plan and
       * 2. Plan is not expired and
       * 3. Workspace is not blocked
       */
      if (
        workspace.tariffPlanId.toString() === tariffPlanId && // 1
        !workspace.isTariffPlanExpired() && // 2
        !workspace.isBlocked // 3
      ) {
        isCardLinkOperation = true;
      }

      let paymentAmount = plan.monthlyCharge;
      let paymentPromo;

      if (promoCode && !isCardLinkOperation) {
        try {
          const promoCodeService = new PromoCodeService(factories);
          const pricing = await promoCodeService.getPricingForPlan(promoCode, user.id, workspace._id.toString(), plan);

          paymentAmount = pricing.finalAmount;
          paymentPromo = buildPaymentPromoData(pricing, promoUtm);
        } catch (error) {
          throwPromoCodeGraphQLError(error);
        }
      }

      // Calculate next payment date
      const lastChargeDate = workspace.lastChargeDate ? new Date(workspace.lastChargeDate) : now;
      const nextPaymentDate = isCardLinkOperation ? new Date(lastChargeDate) : new Date(now);

      if (workspace.isDebug) {
        nextPaymentDate.setDate(nextPaymentDate.getDate() + 1);
      } else {
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      }

      const checksumData = isCardLinkOperation
        ? {
          isCardLinkOperation: true as const,
          workspaceId: workspace._id.toString(),
          userId: user.id,
          nextPaymentDate: nextPaymentDate.toISOString(),
        }
        : {
          workspaceId: workspace._id.toString(),
          userId: user.id,
          tariffPlanId: plan._id.toString(),
          shouldSaveCard: Boolean(shouldSaveCard),
          nextPaymentDate: nextPaymentDate.toISOString(),
          ...(paymentPromo ? { promo: paymentPromo } : {}),
        };

      const checksum = await checksumService.generateChecksum(checksumData);

      /**
       * Send info to Telegram (non-blocking)
       */
      telegram
        .sendMessage(`👀 [Billing / Compose payment]

card link operation: ${isCardLinkOperation}
amount: ${+paymentAmount} RUB
last charge date: ${workspace.lastChargeDate?.toISOString()}
next payment date: ${nextPaymentDate.toISOString()}
workspace id: ${workspace._id.toString()}
debug: ${Boolean(workspace.isDebug)}`
        , TelegramBotURLs.Money)
        .catch(e => console.error('Error while sending message to Telegram: ' + e));

      return {
        invoiceId,
        plan: {
          id: plan._id.toString(),
          name: plan.name,
          monthlyCharge: paymentAmount,
        },
        isCardLinkOperation,
        currency: 'RUB',
        checksum,
        nextPaymentDate,
        cloudPaymentsPublicId: process.env.CLOUDPAYMENTS_PUBLIC_ID || '',
        promo: paymentPromo,
      };
    },
  },
  /**
   * Resolver for Union Payload type.
   * Represents two types of payload depending on the operation's type
   */
  BusinessOperationPayload: {
    /**
     * Returns type of the payload
     * @param payload - result from resolver above
     */
    __resolveType(payload: BusinessOperationPayloadType): string {
      if ('cardPan' in payload) {
        return 'PayloadOfDepositByUser';
      }

      return 'PayloadOfWorkspacePlanPurchase';

      /**
       * @todo access to operation.type
       */
      /*
       * if (operation.type) {
       *   case BusinessOperationType.WorkspacePlanPurchase:
       *     return 'PayloadOfWorkspacePlanPurchase';
       *   default:
       *   case BusinessOperationType.DepositByUser:
       *     return 'PayloadOfDepositByUser';
       * }
       */
    },
  },

  PayloadOfWorkspacePlanPurchase: {
    /**
     * Resolver for workspace by workspaceId
     *
     * @param payload - operation metadata
     * @param _args - resolver args
     * @param factories - resolver factories
     */
    async workspace(payload: PayloadOfWorkspacePlanPurchase, _args: undefined, { factories }: ResolverContextWithUser): Promise<WorkspaceModel | null> {
      return factories.workspacesFactory.findById(payload.workspaceId.toHexString());
    },
  },

  PayloadOfDepositByUser: {
    /**
     * Resolver for workspace by workspaceId
     *
     * @param payload - operation metadata
     * @param _args - resolver args
     * @param factories - resolver factories
     */
    async workspace(payload: PayloadOfDepositByUser, _args: undefined, { factories }: ResolverContextWithUser): Promise<WorkspaceModel | null> {
      return factories.workspacesFactory.findById(payload.workspaceId.toHexString());
    },

    /**
     * Resolver for user by userId
     *
     * @param payload - operation metadata
     * @param _args - resolver args
     * @param factories - resolver factories
     */
    async user(payload: PayloadOfDepositByUser, _args: undefined, { factories }: ResolverContextWithUser): Promise<UserModel | null> {
      return factories.usersFactory.findById(payload.userId.toHexString());
    },
  },

  Mutation: {
    /**
     * Preview discount promo or immediately apply grant_plan promo.
     *
     * @param _obj - parent object
     * @param input - promo code input
     * @param user - current authorized user
     * @param factories - factories for working with models
     */
    async previewPromoCode(
      _obj: undefined,
      { input }: PreviewPromoCodeArgs,
      { user, factories }: ResolverContextWithUser
    ): Promise<PromoCodePreviewResult & { applied: boolean }> {
      const workspace = await factories.workspacesFactory.findById(input.workspaceId);

      if (!workspace) {
        throw new UserInputError(PromoCodeErrorCode.Invalid);
      }

      const member = await workspace.getMemberInfo(user.id);

      if (!member || !('isAdmin' in member) || !member.isAdmin) {
        throw new UserInputError(PromoCodeErrorCode.Invalid);
      }

      const promoCodeService = new PromoCodeService(factories);

      try {
        const preview = await promoCodeService.preview(input.value, user.id, input.workspaceId);

        if (preview.benefitType !== 'grant_plan') {
          return {
            ...preview,
            applied: false,
          };
        }

        await promoCodeService.applyGrantPlan(input.value, user.id, workspace, validateUtmParams(input.utm));

        await publish('cron-tasks', 'cron-tasks/limiter', JSON.stringify({
          type: 'unblock-workspace',
          workspaceId: workspace._id.toString(),
        }));

        return {
          ...preview,
          applied: true,
        };
      } catch (error) {
        throwPromoCodeGraphQLError(error);
      }
    },

    /**
     * Mutation for processing payment via saved card
     *
     * @param _obj - parent object
     * @param args - mutation args
     * @param user - current authorized user
     * @param factories - factories for working with models
     */
    async payWithCard(_obj: undefined, args: PayWithCardArgs, { factories, user }: ResolverContextWithUser): Promise<any> {
      const paymentData = checksumService.parseAndVerifyChecksum(args.input.checksum);

      if (!('tariffPlanId' in paymentData)) {
        throw new UserInputError('Invalid checksum');
      }

      const fullUserInfo = await factories.usersFactory.findById(user.id);

      const workspace = await factories.workspacesFactory.findById(paymentData.workspaceId);
      const member = await workspace?.getMemberInfo(user.id);

      const plan = await factories.plansFactory.findById(paymentData.tariffPlanId);

      if (!workspace || !member || !plan || !fullUserInfo) {
        throw new UserInputError('Wrong checksum data');
      }

      const planPaymentAmount = paymentData.promo?.finalAmount ?? plan.monthlyCharge;

      const token = fullUserInfo.bankCards?.find(card => card.id === args.input.cardId)?.token;

      if (!token) {
        throw new UserInputError('There is no saved card with provided id');
      }

      const jsonData: CloudPaymentsJsonData = {
        checksum: args.input.checksum,
      };

      const isTariffPlanExpired = workspace.isTariffPlanExpired();
      const dueDate = workspace.getTariffPlanDueDate();

      if (args.input.isRecurrent) {
        const interval = workspace.isDebug ? 'Day' : 'Month';

        jsonData.cloudPayments = {
          recurrent: {
            interval,
            period: 1,
          },
        };

        /**
         * If workspace has active tariff plan (not expired),
         * we need to withdraw money only after tariff plan expired
         */
        if (!isTariffPlanExpired) {
          jsonData.cloudPayments.recurrent.startDate = dueDate.toDateString();
          jsonData.cloudPayments.recurrent.amount = planPaymentAmount;
        }
      }

      let amount = planPaymentAmount;

      const isPaymentForCurrentTariffPlan = workspace.tariffPlanId.toString() === plan._id.toString();

      /**
       * True when we need to withdraw the amount only to validate the subscription
       */
      const isOnlyCardValidationNeeded = args.input.isRecurrent && isPaymentForCurrentTariffPlan && !isTariffPlanExpired;

      if (isOnlyCardValidationNeeded) {
        amount = AMOUNT_FOR_CARD_VALIDATION;
      }

      const result = await cloudPaymentsApi.payByToken({
        AccountId: user.id,
        Amount: amount,
        Token: token,
        Currency: 'RUB',
        JsonData: jsonData,
      });

      const operation = await factories.businessOperationsFactory.getBusinessOperationByTransactionId(result.Model.TransactionId.toString());

      return {
        recordId: operation?._id,
        record: operation,
      };
    },
  },
};
