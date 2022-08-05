import UserModel from '../models/user.js';

const Mutation = {
  user: () => ({}),
};

const UserMutations = {
  signUp: async (_root: Record<string, never>, { email }: {email: string}) => {
    await UserModel.createByEmail(email);

    return true;
  },
};

export default {
  Mutation,
  UserMutations,
};
