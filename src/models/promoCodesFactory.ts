import AbstractModelFactory from './abstactModelFactory';
import PromoCodeModel from './promoCode';
import { Collection, Db } from 'mongodb';
import { PromoCodeDBScheme } from '@hawk.so/types';

/**
 * Promo codes factory to work with promoCodes collection.
 */
export default class PromoCodesFactory extends AbstractModelFactory<PromoCodeDBScheme, PromoCodeModel> {
  /**
   * DataBase collection to work with.
   */
  protected collection: Collection<PromoCodeDBScheme>;

  /**
   * Index creation promise.
   */
  private indexesPromise?: Promise<void>;

  /**
   * Creates promo codes factory instance.
   *
   * @param dbConnection - connection to DataBase
   */
  constructor(dbConnection: Db) {
    super(dbConnection, PromoCodeModel);
    this.collection = dbConnection.collection('promoCodes');
  }

  /**
   * Finds promo code by normalized value.
   *
   * @param value - normalized promo code value
   */
  public async findByValue(value: string): Promise<PromoCodeModel | null> {
    await this.ensureIndexesOnce();

    const promoCode = await this.collection.findOne({ value });

    if (!promoCode) {
      return null;
    }

    return new PromoCodeModel(promoCode);
  }

  /**
   * Ensures promo code indexes exist before queries.
   *
   * MongoDB createIndex is idempotent: after API restart it reuses an existing index
   * with the same keys/options and does not throw if the index is already present.
   */
  private async ensureIndexesOnce(): Promise<void> {
    if (!this.indexesPromise) {
      this.indexesPromise = this.collection.createIndex({ value: 1 }, { unique: true }).then(() => undefined);
    }

    await this.indexesPromise;
  }
}
