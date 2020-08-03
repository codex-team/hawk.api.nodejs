import AbstractModelFactory from './abstactModelFactory';
import { Collection, Db } from 'mongodb';
import PlanModel, { PlanDBScheme } from "./plan";
import DataLoaders from '../dataLoaders';

/**
 * Plans factory to work with Plan Model
 */
export default class PlansFactory extends AbstractModelFactory<PlanDBScheme, PlanModel> {
  /**
   * DataBase collection to work with
   */
  protected collection: Collection<PlanDBScheme>;

  /**
   * DataLoaders for fetching data from database
   */
  private dataLoaders: DataLoaders;

  /**
   * Creates plans factory instance
   * @param dbConnection - connection to DataBase
   * @param dataLoaders - dataLoaders for fetching data
   */
  constructor(dbConnection: Db, dataLoaders: DataLoaders) {
    super(dbConnection, PlanModel);
    this.collection = dbConnection.collection('plans');
    this.dataLoaders = dataLoaders;
  }

  /**
   * Find plan by its id
   */
  public async findById(id: string): Promise<PlanModel | null> {
    const planData = await this.dataLoaders.planById.load(id);

    if (!planData) {
      return null;
    }

    return new PlanModel(planData);
  }

  /**
   * Find plan to be used by default
   */
  public async findDefault(): Promise<PlanModel | null> {
    const planData = await this.collection.findOne({
      isDefault: true
    });

    return new PlanModel(planData);
  }

  /**
   * Creates new plan in DataBase
   */
  public async create(planData: PlanDBScheme): Promise<PlanModel> {
    const planId = (await this.collection.insertOne(planData)).insertedId;

    const result = await this.collection.findOne(
      { _id: planId },
      { returnOriginal: false }
    );

    return new PlanModel(result.value);
  }
}
