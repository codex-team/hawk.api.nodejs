const { gql } = require("apollo-server-express");

export const typeDefs = gql`
  type Query {
    hello: String!
  }
`;
