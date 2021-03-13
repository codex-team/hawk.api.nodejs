import { UserDBScheme, UserNotificationType } from 'hawk.types';
import { ObjectId } from 'mongodb';
import { CheckRequest } from '../../src/billing/types';
import { CardType, Currency, OperationStatus, OperationType } from '../../src/billing/types/enums';

export const user: UserDBScheme = {
  _id: new ObjectId(),
  notifications: {
    whatToReceive: {
      [UserNotificationType.IssueAssigning]: true,
      [UserNotificationType.SystemMessages]: true,
      [UserNotificationType.WeeklyDigest]: true,
    },
    channels: {
      email: {
        isEnabled: true,
        endpoint: 'test@hawk.so',
        minPeriod: 10,
      },
    },
  },
};
export const transactionId = 880555;
/**
 * Basic check request
 */
export const mainRequest: CheckRequest = {
  Amount: '20',
  CardExpDate: '06/25',
  CardFirstSix: '578946',
  CardLastFour: '5367',
  CardType: CardType.VISA,
  Currency: Currency.USD,
  DateTime: new Date(),
  OperationType: OperationType.PAYMENT,
  Status: OperationStatus.COMPLETED,
  TestMode: false,
  TransactionId: transactionId,
  Issuer: 'Codex Bank',
};

/**
 * Generates request for payment via subscription
 *
 * @param accountId - id of the account who makes payment
 */
export function getRequestWithSubscription(accountId: string): CheckRequest {
  return {
    ...mainRequest,
    SubscriptionId: '123',
    AccountId: accountId,
    Amount: '10',
  };
}
