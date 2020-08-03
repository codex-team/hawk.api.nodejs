import { Collection, ObjectId } from 'mongodb';
import AbstractModel from './abstractModel';

/**
 * Plan representation in DataBase
 */
export interface PlanDBScheme {
  /**
   * Plan's id
   */
  _id: ObjectId;

  /**
   * Plan's name
   */
  name: string;

  /**
   * Monthly charge for plan
   */
  monthlyCharge: number;

  /**
   * Maximum amount of events available for plan
   */
  eventsLimit: number;

  /**
   * Is this plan used by default?
   */
  isDefault: boolean;
}

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
   * monthly charge for plan
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
   * Model's collection
   */
  protected collection: Collection<PlanDBScheme>;

  constructor(planData: PlanDBScheme) {
    super(planData);
    this.collection = this.dbConnection.collection<PlanDBScheme>('plans');
  }

  /**
   * Find plan by id
   */
  public async find(planId: string): Promise<PlanDBScheme[]> {
    return this.collection.findOne({
      _id: ObjectId(planId)
    });
  }

  /**
   * Find default tariff plan
   */
  public async getDefaultPlan(): Promise<PlanDBScheme> {
    return this.collection.findOne({
      isDefault: true
    });
  }
}
