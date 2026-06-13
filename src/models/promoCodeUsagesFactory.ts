import AbstractModelFactory from './abstactModelFactory';
import PromoCodeUsageModel from './promoCodeUsage';
import { Collection, Db, ObjectId } from 'mongodb';
import { PromoCodeUsageDBScheme } from '@hawk.so/types';

/**
 * Promo code usages factory to work with promoCodeUsages collection.
 */
export default class PromoCodeUsagesFactory extends AbstractModelFactory<PromoCodeUsageDBScheme, PromoCodeUsageModel> {
  /**
   * DataBase collection to work with.
   */
  protected collection: Collection<PromoCodeUsageDBScheme>;

  /**
   * Index creation promise.
   */
  private indexesPromise?: Promise<void>;

  /**
   * Creates promo code usages factory instance.
   *
   * @param dbConnection - connection to DataBase
   */
  constructor(dbConnection: Db) {
    super(dbConnection, PromoCodeUsageModel);
    this.collection = dbConnection.collection('promoCodeUsages');
  }

  /**
   * Counts successful usages of a promo code.
   *
   * @param promoCodeId - promo code id
   */
  public async countByPromoCodeId(promoCodeId: ObjectId): Promise<number> {
    await this.ensureIndexesOnce();

    return this.collection.countDocuments({ promoCodeId });
  }

  /**
   * Finds successful usage by promo code and user.
   *
   * @param promoCodeId - promo code id
   * @param userId - user id
   */
  public async findByPromoCodeAndUser(promoCodeId: ObjectId, userId: string): Promise<PromoCodeUsageModel | null> {
    await this.ensureIndexesOnce();

    const usage = await this.collection.findOne({
      promoCodeId,
      userId,
    });

    if (!usage) {
      return null;
    }

    return new PromoCodeUsageModel(usage);
  }

  /**
   * Finds successful usage by promo code and workspace.
   *
   * @param promoCodeId - promo code id
   * @param workspaceId - workspace id
   */
  public async findByPromoCodeAndWorkspace(promoCodeId: ObjectId, workspaceId: ObjectId): Promise<PromoCodeUsageModel | null> {
    await this.ensureIndexesOnce();

    const usage = await this.collection.findOne({
      promoCodeId,
      workspaceId,
    });

    if (!usage) {
      return null;
    }

    return new PromoCodeUsageModel(usage);
  }

  /**
   * Creates successful promo code usage.
   *
   * @param usageData - promo code usage data
   */
  public async create(usageData: Omit<PromoCodeUsageDBScheme, '_id'>): Promise<PromoCodeUsageModel> {
    await this.ensureIndexesOnce();

    const usage = {
      _id: new ObjectId(),
      ...usageData,
    };

    await this.collection.insertOne(usage);

    return new PromoCodeUsageModel(usage);
  }

  /**
   * Ensures promo usage indexes exist before queries.
   *
   * MongoDB createIndex is idempotent: after API restart it reuses an existing index
   * with the same keys/options and does not throw if the index is already present.
   */
  private async ensureIndexesOnce(): Promise<void> {
    if (!this.indexesPromise) {
      this.indexesPromise = Promise.all([
        this.collection.createIndex({ promoCodeId: 1 }),
        this.collection.createIndex({
          promoCodeId: 1,
          userId: 1,
        }, { unique: true }),
        this.collection.createIndex({
          promoCodeId: 1,
          workspaceId: 1,
        }, { unique: true }),
        this.collection.createIndex({ workspaceId: 1 }),
        this.collection.createIndex({ userId: 1 }),
      ]).then(() => undefined);
    }

    await this.indexesPromise;
  }
}
