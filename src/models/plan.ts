import { Collection, ObjectId } from 'mongodb';
import AbstractModel from './abstractModel';
import { PlanDBScheme } from '@hawk.so/types';

/**
 * Plan model
 */
export default class PlanModel extends AbstractModel<PlanDBScheme> implements PlanDBScheme {
  /**
   * Plan's id
   */
  public _id!: ObjectId;

  /**
   * Plan's name
   */
  public name!: string;

  /**
   * Monthly charge for plan in dollars
   */
  public monthlyCharge!: number;

  /**
   * Maximum amount of events available for plan
   */
  public eventsLimit!: number;

  /**
   * Is this plan used by default?
   */
  public isDefault!: boolean;

  /**
   * Special plans to be selected manually
   * No one cannot be switched to this plan by api
   */
  public isHidden!: boolean;

  /**
   * Model's collection
   */
  protected collection: Collection<PlanDBScheme>;

  /**
   * Create Plan instance
   * @param planData - plan's data
   */
  constructor(planData: PlanDBScheme) {
    super(planData);
    this.collection = this.dbConnection.collection<PlanDBScheme>('plans');
  }

  /**
   * Find plan by id
   */
  public async find(planId: string): Promise<PlanDBScheme | null> {
    return this.collection.findOne({
      _id: new ObjectId(planId),
    });
  }

  /**
   * Find default tariff plan
   */
  public async getDefaultPlan(): Promise<PlanDBScheme | null> {
    return this.collection.findOne({
      isDefault: true,
    });
  }
}
