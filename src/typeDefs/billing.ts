import { gql } from 'apollo-server-express';

export default gql`
"""
Languages supported by the Tinkoff
"""
enum SupportedBillingLanguages {
  EN
  RU
}

"""
Payment link structure
"""
type BillingSession {
  """
  Total payment amount in kopecs
  """
  amount: Long! @renameFrom(name: "Amount")

  """
  Payment status
  """
  status: String! @renameFrom(name: "Status")

  """
  If the payment is successfull
  """
  success: Boolean! @renameFrom(name: "Success")

  """
  URL to the payment page
  """
  paymentURL: String! @renameFrom(name: "PaymentURL")
}

"""
Minimal plan info used in composePayment response
"""
type ComposePaymentPlanInfo {
  """
  Plan id in MongoDB
  """
  id: ID!

  """
  Plan name
  """
  name: String!

  """
  Monthly charge for plan
  """
  monthlyCharge: Int!
}

"""
User bank card
"""
type BankCard {
  """
  Bank card id
  """
  id: ID!

  """
  Last four numbers of card PAN
  """
  lastFour: Int!
}


"""
Types of business operations
"""
enum BusinessOperationType {
  """
  Workspace plan purchase by payment worker
  """
  WORKSPACE_PLAN_PURCHASE

  """
  Workspace deposit balance by user
  """
  DEPOSIT_BY_USER

  """
  Charge minimal amount of money to link a card for further recurrent payments
  """
  CARD_LINK_CHARGE

  """
  Refund the money that were charged to link a card
  """
  CARD_LINK_REFUND
}


"""
Business operations statuses
"""
enum BusinessOperationStatus {
  """
  Business operation is pending
  """
  PENDING

  """
  Business operation is confirmed
  """
  CONFIRMED

  """
  Business operation is rejected
  """
  REJECTED
}

"""
Business operation payload type for 'DepositByUser' operation type
"""
type PayloadOfDepositByUser {
  """
  Workspace to which the payment is credited
  """
  workspace: Workspace!

  """
  Amount of payment in US cents
  """
  amount: Long!

  """
  User who made the payment
  """
  user: User!

  """
  PAN of card which user made the payment
  """
  cardPan: String
}

"""
Business operation payload type for 'WorkspacePlanPurchase' operation type
"""
type PayloadOfWorkspacePlanPurchase {
  """
  Workspace to which the payment is debited
  """
  workspace: Workspace!

  """
  1/100 of the final amount. (US cents for USD, kopecks for RUB)
  """
  amount: Long!

  """
  Currency of payment
  """
  currency: String!
}

"""
All available payload types for different types of operations
"""
union BusinessOperationPayload = PayloadOfDepositByUser | PayloadOfWorkspacePlanPurchase

"""
Business operation object
"""
type BusinessOperation {
  """
  Id of operation
  """
  id: String! @renameFrom(name: "_id")

  """
  Business operation type
  """
  type: BusinessOperationType!

  """
  Indicates current state of the operation
  """
  status: BusinessOperationStatus!

  """
  Metadata related to the operation type
  """
  payload: BusinessOperationPayload!

  """
  When the operation was registered
  """
  dtCreated: DateTime!
}

"""
Input for single payment
"""
input PayOnceInput {
  """
  Total payment amount in kopecs
  """
  amount: Long!

  """
  Workspace id for which the payment will be made
  """
  workspaceId: ID!

  """
  Payment form language
  """
  language: SupportedBillingLanguages = RU
}


"""
Input for composePayment query
"""
input ComposePaymentInput {
  """
  Workspace id for which the payment will be made
  """
  workspaceId: ID!

  """
  Tariff plan id user is going to pay for
  """
  tariffPlanId: ID!

  """
  Whether card should be saved for future recurrent payments
  """
  shouldSaveCard: Boolean
}

"""
Response of composePayment query
"""
type ComposePaymentResponse {
  """
  Human-readable invoice identifier
  """
  invoiceId: String!

  """
  Selected plan info
  """
  plan: ComposePaymentPlanInfo!

  """
  True if only card linking validation payment is expected
  """
  isCardLinkOperation: Boolean!

  """
  Currency code
  """
  currency: String!

  """
  Checksum for subsequent payment verification
  """
  checksum: String!

  """
  Next payment date (recurrent start)
  """
  nextPaymentDate: DateTime!
}


extend type Query {
  """
  Get workspace billing history
  """
  businessOperations("Workspaces IDs" ids: [ID!] = []): [BusinessOperation!]! @requireAuth @requireAdmin

  """
  Prepare payment data before charge (GraphQL version of composePayment)
  """
  composePayment(input: ComposePaymentInput!): ComposePaymentResponse! @requireAuth
}

"""
Data for processing payment with saved card
"""
input PayWithCardInput {
  """
  Checksum for data validation
  """
  checksum: String!

  """
  Card id for payment
  """
  cardId: String!

  """
  Is payment recurrent or not. If payment is recurrent, then the money will be debited every month
  """
  isRecurrent: Boolean
}

"""
Response of mutation for processing payment with saved card
"""
type PayWithCardResponse {
  """
  Id of the created business operation
  """
  recordId: ID!

  """
  Created business operation
  """
  record: BusinessOperation!
}

extend type Mutation {
  """
  Remove card
  """
  removeCard(cardNumber: String!): Boolean! @requireAuth

  """
  Mutation for processing payment with saved card
  """
  payWithCard(
    input: PayWithCardInput!
  ): PayWithCardResponse! @requireAuth

  """
  Returns JSON data with payment link and initiate card attach procedure
  """
  attachCard(language: String): BillingSession! @requireAuth
}
`;
