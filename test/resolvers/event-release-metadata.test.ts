import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql, GraphQLObjectType, GraphQLString } from 'graphql';
import eventTypeDefs from '../../src/typeDefs/event';

jest.mock('../../src/resolvers/helpers/eventsFactory', () => ({}));
jest.mock('../../src/resolvers/helpers/bulkEventUtils', () => ({}));
jest.mock('../../src/services/askAi', () => ({}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const eventResolvers = require('../../src/resolvers/event');

const schema = makeExecutableSchema({
  typeDefs: [eventTypeDefs, `
    type Query { event: Event }
    type Mutation { _: Boolean }
    type User { id: ID }
    type ChartLine { label: String }
    type TaskManagerItem { id: ID }
    scalar DateTime
    scalar JSONObject
    scalar EncodedJSON
    directive @renameFrom(name: String!) on FIELD_DEFINITION
    directive @default(value: String!) on FIELD_DEFINITION
    directive @requireUserInWorkspace on FIELD_DEFINITION
    directive @requireAdmin on FIELD_DEFINITION
  `],
  resolvers: {
    Event: { firstSeenInRelease: eventResolvers.Event.firstSeenInRelease },
  },
});

const source = `{
  event {
    firstSeenInRelease
    resolvedInRelease
    regressionInRelease
    payload { release }
  }
}`;

describe('Event release metadata GraphQL contract', () => {
  it.each(['firstSeenInRelease', 'resolvedInRelease', 'regressionInRelease'])('exposes %s as a nullable String', (field) => {
    const eventType = schema.getType('Event') as GraphQLObjectType;

    expect(eventType.getFields()[field].type).toBe(GraphQLString);
  });

  it.each([
    {
      title: 'original event',
      event: { payload: { release: 'original / build+7' } },
      expected: 'original / build+7',
    },
    {
      title: 'selected repetition',
      event: {
        firstSeenInRelease: 'original / build+7',
        payload: { release: 'repeated / build+8' },
      },
      expected: 'original / build+7',
    },
    {
      title: 'legacy original event',
      event: { payload: {} },
      expected: null,
    },
    {
      title: 'repetition whose original has no release',
      event: {
        firstSeenInRelease: null,
        payload: { release: 'later release' },
      },
      expected: null,
    },
    {
      title: 'empty original release',
      event: {
        firstSeenInRelease: '',
        payload: { release: 'later release' },
      },
      expected: '',
    },
  ])('resolves first seen from the $title', async ({ event, expected }) => {
    const { data, errors } = await graphql({
      schema,
      source,
      rootValue: { event },
    });

    expect(errors).toBeUndefined();
    expect(data?.event).toEqual({
      firstSeenInRelease: expected,
      resolvedInRelease: null,
      regressionInRelease: null,
      payload: { release: event.payload.release ?? null },
    });
  });

  it('returns stored lifecycle release names unchanged', async () => {
    const event = {
      payload: { release: 'original release' },
      resolvedInRelease: 'hotfix / opaque+name',
      regressionInRelease: 'canary build:abc',
    };
    const { data, errors } = await graphql({
      schema,
      source,
      rootValue: { event },
    });

    expect(errors).toBeUndefined();
    expect(data?.event).toEqual({
      firstSeenInRelease: event.payload.release,
      resolvedInRelease: event.resolvedInRelease,
      regressionInRelease: event.regressionInRelease,
      payload: event.payload,
    });
  });
});
