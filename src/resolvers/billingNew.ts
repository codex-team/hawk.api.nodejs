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
  };
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
    }> {
      const { workspaceId, tariffPlanId, shouldSaveCard } = input;

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

      const isCardLinkOperation = workspace.tariffPlanId.toString() === tariffPlanId && !workspace.isTariffPlanExpired();

      // Calculate next payment date
      const lastChargeDate = workspace.lastChargeDate ? new Date(workspace.lastChargeDate) : now;
      let nextPaymentDate = isCardLinkOperation ? new Date(lastChargeDate) : new Date(now);

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
          };

      const checksum = await checksumService.generateChecksum(checksumData);

      return {
        invoiceId,
        plan: {
          id: plan._id.toString(),
          name: plan.name,
          monthlyCharge: plan.monthlyCharge,
        },
        isCardLinkOperation,
        currency: 'RUB',
        checksum,
        nextPaymentDate,
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
          jsonData.cloudPayments.recurrent.amount = plan.monthlyCharge;
        }
      }

      let amount = plan.monthlyCharge;

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
