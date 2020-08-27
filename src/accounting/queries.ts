// language=GraphQL
/**
 * Query to get account by id
 */
export const QUERY_GET_ACCOUNT = `
query getAccount($id: ID!) {
  getAccount(id: $id) {
    id
    name
    currency
  }
}
`;

// language=GraphQL
/**
 * Mutation for creating account
 */
export const MUTATION_CREATE_ACCOUNT = `
  mutation AccountCreateMutation($input: AccountInput!) {
    account {
      create(input: $input) {
        recordId
      }
    }
  }
`;
