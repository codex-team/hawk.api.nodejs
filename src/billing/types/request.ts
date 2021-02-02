/**
 * Payment currency
 */
export enum Currency {
  USD = 'USD',
  RUB = 'RUB'
}

/**
 * Possible card types
 */
export enum CardType {
  VISA = 'Visa',
  MASTERCARD = 'Mastercard',
  MAESTRO = 'Maestro',
  MIR = 'МИР'
}

/**
 * Operation type
 */
export enum OperationType {
  /**
   * Payment operation
   */
  PAYMENT = 'Payment',

  /**
   * Refund operation
   */
  REFUND = 'Refund',

  /**
   * Payout to card
   */
  CARD_PAYOUT = 'CardPayout'
}

/**
 * Payment status in case of successful completion
 */
export enum OperationStatus {
  /**
   * Status for one-step payments,
   */
  COMPLETED = 'Completed',

  /**
   * Status for two-step payments
   */
  AUTHORIZED = 'Authorized'
}

/**
 * Possible subscription status
 */
export enum SubscriptionStatus {
  /**
   * Subscription active.
   * After creation and next successful payment
   */
  ACTIVE = 'Active',

  /**
   * Subscription expired.
   * After one or two consecutive unsuccessful payment attempts
   */
  PASTDUE = 'PastDue',

  /**
   * Subscription cancelled.
   * In case of cancellation upon request
   */
  CANCELLED = 'Cancelled',

  /**
   * Subscription rejected.
   * In case of three unsuccessful payment attempts in a row
   */
  REJECTED = 'Rejected',

  /**
   * Subscription expired.
   * In case of completion of the maximum number of periods (if specified)
   */
  EXPIRED = 'Expired'
}

/**
 * Transaction rejection code
 * https://developers.cloudpayments.ru/#kody-oshibok
 */
export enum ReasonCode {
  /**
   * Refusal of the issuer to conduct an online transaction
   */
  REFER_TO_CARD_ISSUER = 5001,

  /**
   * Refusal of the issuer to conduct an online transaction
   */
  INVALID_MERCHANT = 5003,

  /**
   * Card lost
   */
  PICK_UP_CARD = 5004,

  /**
   * Refusal of the issuer without explanation
   */
  DO_NOT_HONOR = 5005,

  /**
   * Network refusal to carry out the operation or incorrect CVV code
   */
  ERROR = 5006,

  /**
   * Card lost
   */
  PICK_UP_CARD_SPECIAL_CONDITIONS = 5007,

  /**
   * The card is not available for online payments
   */
  INVALID_TRANSACTION = 5012,

  /**
   * Too small or too large transaction amount
   */
  AMOUNT_ERROR = 5013,

  /**
   * Incorrect card number
   */
  INVALID_CARD_NUMBER = 5014,

  /**
   * Issuer not found
   */
  NO_SUCH_ISSUER = 5015,

  /**
   * Refusal of the issuer without explanation
   */
  TRANSACTION_ERROR = 5019,

  /**
   * Error on the acquirer's side - the transaction was incorrectly formed
   */
  FORMAT_ERROR = 5030,

  /**
   * Unknown card issuer
   */
  BANK_NOT_SUPPORTED_BY_SWITCH = 5031,

  /**
   * Lost card has expired
   */
  EXPIRED_CARD_PICKUP = 5033,

  /**
   * Issuer refusal - suspicion of fraud
   */
  SUSPECTED_FRAUD = 5034,

  /**
   * The card is not intended for payments
   */
  RESTRICTED_CARD = 5036,

  /**
   * Card lost
   */
  LOST_CARD = 5041,

  /**
   * Card stolen
   */
  STOLEN_CARD = 5043,

  /**
   * Insufficient funds
   */
  INSUFFICIENT_FUNDS = 5051,

  /**
   * The card is expired or the expiration date is incorrect
   */
  TRANSACTION_NOT_PERMITTED = 5057,

  /**
   * Restriction on the card
   */
  RESTRICTED_CARD_2 = 5062,

  /**
   * Card blocked due to security breaches
   */
  SECURITY_VIOLATION = 5063,

  /**
   * The limit of card transactions has been exceeded
   */
  EXCEED_WITHDRAWAL_FREQUENCY = 5065,

  /**
   * Invalid CVV code
   */
  INCORRECT_CVV = 5082,

  /**
   * Issuer unavailable
   */
  TIMEOUT = 5091,

  /**
   * Issuer unavailable
   */
  CANNOT_REACH_NETWORK = 5092,

  /**
   * Acquiring bank or network error
   */
  SYSTEM_ERROR = 5096,

  /**
   * The transaction cannot be processed for other reasons
   */
  UNABLE_TO_PROCESS = 5204,

  /**
   * 3-D Secure authorization failed
   */
  AUTHENTICATION_FAILED = 5206,

  /**
   * 3-D Secure authorization not available
   */
  AUTHENTICATION_UNVAILABLE = 5207,

  /**
   * Acquiring limits for transactions
   */
  ANTI_FRAUD = 5300
}

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
   * Currency: RUB/USD
   */
  Currency: Currency;

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
  CardType: CardType;

  /**
   * Card expiration date in MM/YY format
   */
  CardExpDate: string;

  /**
   * Test mode sign
   */
  TestMode: boolean;

  /**
   * Payment status in case of successful completion:
   * Completed - for one-step payments,
   * Authorized - for two-step payments
   */
  Status: OperationStatus;

  /**
   * Operation type: Payment/Refund/CardPayout
   */
  OperationType: OperationType;

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
  Data?: object;
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
   * Currency: RUB/USD
   */
  Currency: Currency;

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
  CardType: CardType;

  /**
   * Card expiration date in MM/YY format
   */
  CardExpDate: string;

  /**
   * Test mode sign
   */
  TestMode: boolean;

  /**
   * Payment status in case of successful completion:
   * Completed - for one-step payments,
   * Authorized - for two-step payments
   */
  Status: OperationStatus;

  /**
   * Operation type: Payment/CardPayout
   */
  OperationType: Exclude<OperationType, OperationType.REFUND>;

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
  Data?: object;

  /**
   * Card token for repeated payments without entering details
   */
  Token?: string;

  /**
   * Total commission value
   */
  TotalFee: number;

  /**
   * Card product type
   */
  CardProduct?: string;

  /**
   * Payment method ApplePay or GooglePay
   */
  PaymentMethod?: string;

  /**
   * First unsuccessful transaction number
   */
  FallBackScenarioDeclinedTransactionId?: number;
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
   * Currency: RUB/USD
   */
  Currency: Currency;

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
  CardType: CardType;

  /**
   * Card expiration date in MM/YY format
   */
  CardExpDate: string;

  /**
   * Test mode sign
   */
  TestMode: boolean;

  /**
   * Rejection reason
   */
  Reason: string;

  /**
   * Error code
   * https://developers.cloudpayments.ru/#kody-oshibok
   */
  ReasonCode: ReasonCode;

  /**
   * Operation type: Payment/Refund/CardPayout
   */
  OperationType: OperationType;

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
  Data?: object;

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
   * Currency: RUB/USD
   */
  Currency: Currency;

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
  Status: SubscriptionStatus;

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