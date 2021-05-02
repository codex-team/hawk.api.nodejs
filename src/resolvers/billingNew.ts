import BusinessOperationModel from '../models/businessOperation';
import { ResolverContextWithUser } from '../types/graphql';
import WorkspaceModel from '../models/workspace';
import UserModel from '../models/user';
import {
  BusinessOperationPayloadType, BusinessOperationStatus,
  PayloadOfDepositByUser,
  PayloadOfWorkspacePlanPurchase
} from 'hawk.types';
import cloudPaymentsApi from '../utils/cloudPaymentsApi';
import checksumService from '../utils/checksumService';
import { UserInputError } from 'apollo-server-express';

interface PayWithCardArgs {
  input: {
    checksum: string;
    cardId: string;
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

      const result = await cloudPaymentsApi.payByToken({
        AccountId: user.id,
        Amount: plan.monthlyCharge,
        Token: token,
        Currency: 'USD',
        JsonData: {
          checksum: args.input.checksum,
        },
      });

      const operation = await factories.businessOperationsFactory.getBusinessOperationByTransactionId(result.Model.TransactionId.toString());

      return {
        recordId: operation?._id,
        record: operation,
      };
    },
  },
};
