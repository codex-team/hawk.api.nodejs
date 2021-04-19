/**
 * Data based on IP CloudPayments request
 */
export interface IpData {
  /**
   * Payer's IP address
   */
  IpAdress?: string;

  /**
   * ISO3166-1 two-letter country code of the payer's country
   */
  IpCountry?: string;

  /**
   * Payer's city
   */
  IpCity?: string;

  /**
   * Payer's region
   */
  IpRegion?: string;

  /**
   * Payer's district
   */
  IpDistrict?: string;
}
