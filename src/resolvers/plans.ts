import { ResolverContextBase } from '../types/graphql';
import PlanModel from '../models/plan';

export default {
  Query: {
    /**
     * Returns available Hawk tariff plans
     *
     * @param _obj - parent object (undefined for this resolver)
     * @param _args - query args (empty)
     * @param factories - factories for working with models
     */
    async plans(_obj: undefined, _args: {}, { factories }: ResolverContextBase): Promise<PlanModel[]> {
      return factories.plansFactory.findAll();
    },
  },
};
