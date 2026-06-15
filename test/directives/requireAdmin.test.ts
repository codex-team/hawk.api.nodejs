import '../../src/env-test';

import { graphql } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { ForbiddenError } from 'apollo-server-express';
import requireAdminDirective from '../../src/directives/requireAdmin';
import { ObjectId } from 'mongodb';

const { requireAdminDirectiveTypeDefs, requireAdminDirectiveTransformer } = requireAdminDirective();

const typeDefs = `
  ${requireAdminDirectiveTypeDefs}

  type Query {
    verifyPromoCode(input: VerifyPromoCodeInput!): String! @requireAdmin
  }

  input VerifyPromoCodeInput {
    workspaceId: ID!
    value: String!
  }
`;

const resolvers = {
  Query: {
    verifyPromoCode: (): string => 'ok',
  },
};

let schema = makeExecutableSchema({ typeDefs, resolvers });

schema = requireAdminDirectiveTransformer(schema);

function createContext(options: { isAdmin: boolean }) {
  const workspaceId = new ObjectId().toString();
  const userId = new ObjectId().toString();

  return {
    user: {
      id: userId,
      accessTokenExpired: false,
    },
    factories: {
      workspacesFactory: {
        findById: jest.fn().mockResolvedValue({
          _id: new ObjectId(workspaceId),
          getMemberInfo: jest.fn().mockResolvedValue({
            userId: new ObjectId(userId),
            isAdmin: options.isAdmin,
          }),
        }),
      },
      projectsFactory: {
        findById: jest.fn(),
      },
    },
    workspaceId,
  };
}

describe('requireAdmin directive', () => {
  it('should allow mutation when user is workspace admin via input.workspaceId', async () => {
    const context = createContext({ isAdmin: true });

    const result = await graphql({
      schema,
      source: `
        query VerifyPromoCode($input: VerifyPromoCodeInput!) {
          verifyPromoCode(input: $input)
        }
      `,
      variableValues: {
        input: {
          workspaceId: context.workspaceId,
          value: 'PROMO',
        },
      },
      contextValue: context,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.verifyPromoCode).toBe('ok');
  });

  it('should reject mutation when user is not workspace admin via input.workspaceId', async () => {
    const context = createContext({ isAdmin: false });

    const result = await graphql({
      schema,
      source: `
        query VerifyPromoCode($input: VerifyPromoCodeInput!) {
          verifyPromoCode(input: $input)
        }
      `,
      variableValues: {
        input: {
          workspaceId: context.workspaceId,
          value: 'PROMO',
        },
      },
      contextValue: context,
    });

    expect(result.errors?.[0]?.originalError).toBeInstanceOf(ForbiddenError);
  });
});
