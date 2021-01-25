import BusinessOperationModel, {
  BusinessOperationPayloadType,
  PayloadOfDepositByUser,
  PayloadOfWorkspacePlanPurchase
} from '../models/businessOperation';
import { ResolverContextWithUser, ResolverContextBase } from '../types/graphql';
import WorkspaceModel from '../models/workspace';
import UserModel from '../models/user';
import { BusinessOperationStatus, BusinessOperationType } from '../../src/models/businessOperation';
import HawkCatcher from '@hawk.so/nodejs';
import { ObjectID } from 'mongodb';
import { ApolloError, UserInputError } from 'apollo-server-express';
import { PENNY_MULTIPLIER } from 'codex-accounting-sdk';
import * as telegram from '../utils/telegram';
import escapeHTML from 'escape-html';

/**
 * Session that is returned when you try to deposit the balance
 */
interface BillingSession {
  /**
   * Deposit amount in cents
   */
  Amount: number;

  /**
   * Deposit status
   */
  Status: string;

  /**
   * Success status
   */
  Success: boolean;

  /**
   * Redirect URL for payment
   */
  PaymentURL: string;
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
      if ('userId' in payload) {
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
     * Mutation for single payment
     *
     * @param {ResolverObj} _obj
     * @param {PaymentQuery} paymentQuery
     * @param {Object} user - current user object
     */
    async payOnce(
      _obj: undefined,
      { input }: { input: PayloadOfWorkspacePlanPurchase },
      { user, factories, accounting }: ResolverContextBase
    ): Promise<BillingSession> {
      const { amount, workspaceId } = input;

      const workspaceModel = await factories.workspacesFactory.findById(workspaceId.toString());

      if (!workspaceModel) {
        throw new UserInputError('There is no workspace with provided id');
      }

      try {
        const transaction = await accounting.payOnce({
          accountId: workspaceModel.accountId,
          amount,
          description: 'Depositing balance by one-time payment',
        });

        // Create a business operation
        const payloadOfDepositByUser = {
          workspaceId: workspaceModel._id,
          amount: Number(amount) * PENNY_MULTIPLIER,
          userId: new ObjectID(user.id),
          cardPan: '5535',
        };

        const businessOperationData = {
          transactionId: transaction.recordId,
          type: BusinessOperationType.DepositByUser,
          status: BusinessOperationStatus.Confirmed,
          dtCreated: new Date(),
          payload: payloadOfDepositByUser,
        };

        await factories.businessOperationsFactory.create<PayloadOfDepositByUser>(businessOperationData);
      } catch (err) {
        console.error('\nლ(´ڡ`ლ) Error [resolvers:billing:payOnce]: \n\n', err, '\n\n');
        HawkCatcher.send(err);

        throw new ApolloError('An error occurred while depositing the balance');
      }

      const billingSession = {
        Amount: amount,
        Status: BusinessOperationStatus.Confirmed,
        Success: true,
        PaymentURL: 'http://codex.so',
      };

      const message = `💰 Balance of «<b>${escapeHTML(workspaceModel.name)}</b>» workspace was replenished by <b>$${amount}</b>`;

      telegram.sendMessage(message);

      return billingSession;
    },
  },
};
