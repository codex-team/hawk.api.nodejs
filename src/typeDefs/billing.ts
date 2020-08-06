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
  amount: Int! @renameFrom(name: "Amount")

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

type CardInfo {
  """
  Card number (Pan)
  """
  pan: String!

  """
  Card ID
  """
  cardId: String!

  """
  Card expiration date
  """
  expDate: String!
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
Transaction object
"""
type BusinessOperation {
  """
  Id of operation
  """
  id: String!

  """
  Business operation type
  """
  type: BusinessOperationType!

  """
  Indicates current state of the operation
  """
  status: BusinessOperationStatus!
}

"""
Input for single payment
"""
input PayOnceInput {
  """
  Total payment amount in kopecs
  """
  amount: Int!

  """
  Workspace id for which the payment will be made
  """
  workspaceId: ID!

  """
  Payment form language
  """
  language: SupportedBillingLanguages = RU
}


extend type Query {
  """
  Get attached cards
  """
  cardList: [CardInfo!]! @requireAuth

  """
  Get workspace billing history
  """
  businessOperations("Workspaces IDs" ids: [ID!] = []): [BusinessOperation!]! @requireAuth
}

extend type Mutation {
  """
  Remove card
  """
  removeCard(cardNumber: String!): Boolean! @requireAuth

  """
  Initialize recurrent payment
  """
  payWithCard(
    """
    Total payment amount in kopecs
    """
    amount: Int!

    """
    Workspace id for which the payment will be made
    """
    workspaceId: String!

    """
    Unique card identifier for recurrent payment. Omit this to pay with unattached card
    """
    cardId: Int!

    """
    Payment form language
    """
    language: String
  ): Boolean! @requireAuth

  """
  Initialize single payment
  """
  payOnce(
   input: PayOnceInput!
  ): BillingSession! @requireAuth

  """
  Returns JSON data with payment link and initiate card attach procedure
  """
  attachCard(language: String): BillingSession! @requireAuth
}
`;
