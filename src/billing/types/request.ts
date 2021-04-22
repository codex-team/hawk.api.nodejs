import { Currency, OperationType, OperationStatus, SubscriptionStatus, ReasonCode, Interval } from './enums';
import { CardDetails } from './cardDetails';
import { IpData } from './ipData';

/**
 * Check request body
 * https://developers.cloudpayments.ru/#check
 */
export interface CheckRequest extends CardDetails, IpData {
  /**
   * Number of transaction in the system
   */
  TransactionId: number;

  /**
   * Payment amount from the payment parameters
   */
  Amount: string;

  /**
   * Currency: RUB/USD
   */
  Currency: Currency;

  /**
   * Date/time of payment creation in UTC time zone
   */
  DateTime: Date;

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
  Data?: string;
}

/**
 * Pay request body
 * https://developers.cloudpayments.ru/#pay
 */
export interface PayRequest extends CardDetails, IpData {
  /**
   * Number of transaction in the system
   */
  TransactionId: number;

  /**
   * Payment amount from the payment parameters
   */
  Amount: string;

  /**
   * Currency: RUB/USD
   */
  Currency: Currency;

  /**
   * Date/time of payment creation in UTC time zone
   */
  DateTime: Date;

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
   * Name of the card issuing bank
   */
  Issuer?: string;

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
  Data?: string;

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
export interface FailRequest extends CardDetails, IpData {
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
  Data?: string;

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
  Amount: string;

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
  StartDate: string;

  /**
   * Interval. Possible values: Week, Month, Day
   */
  Interval: Interval;

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
  LastTransactionDate?: string;

  /**
   * Date and time of the next payment in the UTC time zone
   */
  NextTransactionDate?: string;
}

/**
 * Data that we expect in the request
 */
export interface WebhookData {
  /**
   * Checksum for validating request and getting data from it
   */
  checksum: string;
}
