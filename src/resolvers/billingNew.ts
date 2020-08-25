import BusinessOperationModel, {
  BusinessOperationPayloadType,
  PayloadOfDepositByUser,
  PayloadOfWorkspacePlanPurchase
} from '../models/businessOperation';
import { ResolverContextWithUser } from '../types/graphql';
import WorkspaceModel from '../models/workspace';
import UserModel from '../models/user';
import { ObjectId } from 'mongodb';

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
      // return factories.businessOperationsFactory.getWorkspacesBusinessOperations(ids);

      /**
       * Leave for testing, will be removed when Garage-side will be finished
       */
      return [
        {
          id: '222',
          type: 'WORKSPACE_PLAN_PURCHASE',
          status: 'CONFIRMED',
          transactionId: '123',
          payload: {
            workspaceId: new ObjectId('5e5fb6303e3a9d0a1933739a'),
            amount: 1000,
          },
          dtCreated: '2020-08-01T00:00:00Z',
        } as unknown as BusinessOperationModel,

        {
          id: 'ad2',
          type: 'DEPOSIT_BY_USER',
          status: 'CONFIRMED',
          transactionId: '124',
          payload: {
            workspaceId: new ObjectId('5e5fb6303e3a9d0a1933739a'),
            amount: 3000,
            userId: new ObjectId('5e4f053246587414198eabda'),
            cardPan: '6363',
          },
          dtCreated: '2020-09-25T04:45:00Z',
        } as unknown as BusinessOperationModel,
      ];
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
};
