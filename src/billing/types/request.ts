/**
 * Check request body
 * https://developers.cloudpayments.ru/#check
 */
export interface CheckRequest {
  /**
   * Number of transaction in the system
   */
  TransactionId: number;

  /**
   * Payment amount from the payment parameters
   */
  Amount: number;

  /**
   * Currency: RUB/USD/UER/GBP
   */
  Currency: string;

  /**
   * Date/time of payment creation in UTC time zone
   */
  DateTime: Date;

  /**
   * First 6 digits of the card number
   */
  CardFirstSix: string;

  /**
   * Last 4 digits of the card number
   */
  CardLastFour: string;

  /**
   * Card payment system: Visa, MasterCard, Maestro or MIR
   */
  CardType: string;

  /**
   * Card expiration date in MM/YY format
   */
  CardExpDate: string;

  /**
   * Test mode sign: 0 or 1
   */
  TestMode: number;

  /**
   * Payment status in case of successful completion:
   * Completed - for one-step payments,
   * Authorized - for two-step payments
   */
  Status: string;

  /**
   * Тип операции: Payment/Refund/CardPayout
   */
  OperationType: string;

  /**
   * Order number from payment parameters
   */
  InvoiceId?: string;

  /**
   * User ID from payment parameters
   */
  AccountId?: string;

  /**
   * Subscription ID (for recurring payments)
   */
  SubscriptionId?: string;

  /**
   * Payee token
   */
  TokenRecipient?: string;

  /**
   * Cardholder name
   */
  Name?: string;

  /**
   * Payer's e-mail address
   */
  Email?: string;

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

  /**
   * Name of the card issuing bank
   */
  Issuer: string;

  /**
   * ISO3166-1 two-letter country code of the card issuer
   */
  IssuerBankCountry?: string;

  /**
   * Payment purpose from payment parameters
   */
  Description?: string;

  /**
   * An arbitrary set of parameters passed to the transaction
   */
  Data?: JSON;
}

/**
 * Pay request body
 * https://developers.cloudpayments.ru/#pay
 */
export interface PayRequest {
  /**
   * Number of transaction in the system
   */
  TransactionId: number;

  /**
   * Payment amount from the payment parameters
   */
  Amount: number;

  /**
   * Currency: RUB/USD/UER/GBP
   */
  Currency: string;

  /**
   * Date/time of payment creation in UTC time zone
   */
  DateTime: Date;

  /**
   * First 6 digits of the card number
   */
  CardFirstSix: string;

  /**
   * Last 4 digits of the card number
   */
  CardLastFour: string;

  /**
   * Card payment system: Visa, MasterCard, Maestro or MIR
   */
  CardType: string;

  /**
   * Card expiration date in MM/YY format
   */
  CardExpDate: string;

  /**
   * Test mode sign: 0 or 1
   */
  TestMode: number;

  /**
   * Payment status in case of successful completion:
   * Completed - for one-step payments,
   * Authorized - for two-step payments
   */
  Status: string;

  /**
   * Тип операции: Payment/Refund/CardPayout
   */
  OperationType: string;

  /**
   * Acquiring bank identifier
   */
  GatewayName: string;

  /**
   * Order number from payment parameters
   */
  InvoiceId?: string;

  /**
   * User ID from payment parameters
   */
  AccountId?: string;

  /**
   * Subscription ID (for recurring payments)
   */
  SubscriptionId?: string;

  /**
   * Payee token
   */
  TokenRecipient?: string;

  /**
   * Cardholder name
   */
  Name?: string;

  /**
   * Payer's e-mail address
   */
  Email?: string;

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

  /**
   * Name of the card issuing bank
   */
  Issuer: string;

  /**
   * ISO3166-1 two-letter country code of the card issuer
   */
  IssuerBankCountry?: string;

  /**
   * Payment purpose from payment parameters
   */
  Description?: string;

  /**
   * An arbitrary set of parameters passed to the transaction
   */
  Data?: JSON;
}

/**
 * Fail request body
 * https://developers.cloudpayments.ru/#fail
 */
export interface FailRequest {
  /**
   * Number of transaction in the system
   */
  TransactionId: number;

  /**
   * Payment amount from the payment parameters
   */
  Amount: number;

  /**
   * Currency: RUB/USD/UER/GBP
   */
  Currency: string;

  /**
   * Date/time of payment creation in UTC time zone
   */
  DateTime: Date;

  /**
   * First 6 digits of the card number
   */
  CardFirstSix: string;

  /**
   * Last 4 digits of the card number
   */
  CardLastFour: string;

  /**
   * Card payment system: Visa, MasterCard, Maestro or MIR
   */
  CardType: string;

  /**
   * Card expiration date in MM/YY format
   */
  CardExpDate: string;

  /**
   * Test mode sign: 0 or 1
   */
  TestMode: number;

  /**
   * Rejection reason
   */
  Reason: string;

  /**
   * Error code
   * https://developers.cloudpayments.ru/#kody-oshibok
   */
  ReasonCode: number;
 /**
  * Тип операции: Payment/Refund/CardPayout
  */
  OperationType: string;

  /**
   * Order number from payment parameters
   */
  InvoiceId?: string;

  /**
   * User ID from payment parameters
   */
  AccountId?: string;

  /**
   * Subscription ID (for recurring payments)
   */
  SubscriptionId?: string;

  /**
   * Payee token
   */
  TokenRecipient?: string;

  /**
   * Cardholder name
   */
  Name?: string;

  /**
   * Payer's e-mail address
   */
  Email?: string;

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

  /**
   * Name of the card issuing bank
   */
  Issuer: string;

  /**
   * ISO3166-1 two-letter country code of the card issuer
   */
  IssuerBankCountry?: string;

  /**
   * Payment purpose from payment parameters
   */
  Description?: string;

  /**
   * An arbitrary set of parameters passed to the transaction
   */
  Data?: JSON;

  /**
   * Card token for repeated payments without entering details
   */
  Token?: string;

  /**
   * Payment method ApplePay or GooglePay
   */
  PaymentMethod: string;

  /**
   * First unsuccessful transaction number
   */
  FallBackScenarioDeclinedTransactionId?: number;
}

/**
 * Reccurrent request body
 * https://developers.cloudpayments.ru/#recurrent
 */
export interface RecurrentRequest {
  /**
   * Subscription ID
   */
  Id: string;

  /**
   * User ID
   */
  AccountId: string;

  /**
   * Free form payment purpose
   */
  Description: string;

  /**
   * Payer's e-mail
   */
  Email: string;

  /**
   * Amount of payment
   */
  Amount: number;

  /**
   * Currency: RUB / USD / EUR / GBP from the payment parameters
   */
  Currency: string;

  /**
   * If the value is true - the payment will be performed according to a two-stage scheme
   */
  RequireConfirmation: boolean;

  /**
   * Date and time of the first payment according to the plan in the UTC time zone
   */
  StartDate: Date;

  /**
   * Interval. Possible values: Week, Month
   */
  Interval: string;

  /**
   * Period. In combination with the interval,
   * 1 Month means once a month, and 2 Week means once every two weeks.
   */
  Period: number;

  /**
   * Subscription statuses
   * https://developers.cloudpayments.ru/#statusy-podpisok-rekurrent
   */
  Status: string;

  /**
   * Number of successful payments
   */
  SuccessfulTransactionsNumber: number;

  /**
   * The number of unsuccessful payments
   * (reset to zero after each successful one)
   */
  FailedTransactionsNumber: number;

  /**
   * Maximum number of payments in a subscription
   */
  MaxPeriods?: number;

  /**
   * Date and time of the last successful payment in the UTC time zone
   */
  LastTransactionDate?: Date;

  /**
   * Date and time of the next payment in the UTC time zone
   */
  NextTransactionDate?: Date;
}