const { gql } = require('apollo-server-express');

module.exports = gql`
  type User {
    id: ID!
    email: String!
    name: String
  }

  type Query {
    hello: String!
  }

  type Mutation {
    register(email: String!, password: String!): Boolean!
    login(email: String!, password: String!): String
  }
`;
