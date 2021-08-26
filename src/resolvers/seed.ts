import UserModel from '../models/user';
import { ResolverContextBase } from '../types/graphql';

/**
 * Resolver available only for e2e environment
 */
export default {
  Mutation: {
    /**
     * Creates user
     *
     * @param _obj - parent object
     * @param email - user email
     * @param password - user password
     * @param factories - factories to work with models
     */
    async createUser(
      _obj: undefined,
      { email, password }: { email: string; password: string },
      { factories }: ResolverContextBase
    ): Promise<UserModel> {
      const user = await factories.usersFactory.create(email, password);

      return user;
    },

    /**
     * Deletes user by email
     *
     * @param _obj - parent object
     * @param email - user email
     * @param factories - factories to work with models
     */
    async deleteUser(
      _obj: undefined,
      { email }: { email: string },
      { factories }: ResolverContextBase
    ): Promise<boolean> {
      return factories.usersFactory.deleteByEmail(email);
    },
  },
};
