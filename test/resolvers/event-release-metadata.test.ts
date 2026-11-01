import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql, GraphQLObjectType, GraphQLString } from 'graphql';
import type { Db } from 'mongodb';
import ReleasesFactory from '../../src/models/releasesFactory';
import eventTypeDefs from '../../src/typeDefs/event';

jest.mock('../../src/resolvers/helpers/eventsFactory', () => ({}));
jest.mock('../../src/resolvers/helpers/bulkEventUtils', () => ({}));
jest.mock('../../src/services/askAi', () => ({}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const eventResolvers = require('../../src/resolvers/event');

const schema = makeExecutableSchema({
  typeDefs: [eventTypeDefs, `
    type Query { event: Event, events: [Event!]! }
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
    Event: {
      firstSeenInRelease: eventResolvers.Event.firstSeenInRelease,
      resolvedInRelease: eventResolvers.Event.resolvedInRelease,
      regressionInRelease: eventResolvers.Event.regressionInRelease,
      isNew: eventResolvers.Event.isNew,
    },
  },
});

const projectId = '507f1f77bcf86cd799439011';
const latestName = 'original / build+7';
const source = `{
  event {
    firstSeenInRelease
    resolvedInRelease
    regressionInRelease
    isNew
    payload { release }
  }
}`;
const metadataSource = '{ event { firstSeenInRelease resolvedInRelease regressionInRelease isNew } }';

describe('Event release metadata GraphQL contract', () => {
  let findOne: jest.Mock;
  let db: Db;
  let context: { factories: { releasesFactory: ReleasesFactory } };

  beforeEach(() => {
    findOne = jest.fn().mockResolvedValue({ release: latestName });
    db = { collection: () => ({ findOne }) } as unknown as Db;
    context = { factories: { releasesFactory: new ReleasesFactory(db) } };
  });

  it.each(['firstSeenInRelease', 'resolvedInRelease', 'regressionInRelease'])('exposes %s as a nullable String', (field) => {
    const eventType = schema.getType('Event') as GraphQLObjectType;

    expect(eventType.getFields()[field].type).toBe(GraphQLString);
  });

  it('exposes isNew as Boolean!', () => {
    const eventType = schema.getType('Event') as GraphQLObjectType;

    expect(eventType.getFields().isNew.type.toString()).toBe('Boolean!');
  });

  it.each([
    {
      title: 'original event',
      event: { payload: { release: latestName } },
      expected: latestName,
    },
    {
      title: 'selected repetition',
      event: {
        firstSeenInRelease: latestName,
        payload: { release: 'repeated / build+8' },
      },
      expected: latestName,
    },
    {
      title: 'old original with a repetition in the latest registered release',
      event: {
        firstSeenInRelease: 'older release',
        payload: { release: latestName },
      },
      expected: 'older release',
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
        payload: { release: latestName },
      },
      expected: null,
    },
    {
      title: 'empty original release',
      event: {
        firstSeenInRelease: '',
        payload: { release: latestName },
      },
      expected: null,
    },
  ])('resolves first seen and isNew from the $title', async ({ event, expected }) => {
    const { data, errors } = await graphql({
      schema,
      source,
      rootValue: { event: { ...event, projectId } },
      contextValue: context,
    });

    expect(errors).toBeUndefined();
    expect(data?.event).toEqual({
      firstSeenInRelease: expected,
      resolvedInRelease: null,
      regressionInRelease: null,
      isNew: expected === latestName,
      payload: { release: event.payload.release ?? null },
    });
    expect(findOne).toHaveBeenCalledTimes(expected === null ? 0 : 1);
  });

  it.each([
    [0, '0'],
    [42, '42'],
    [-1.5, '-1.5'],
    [' opaque / Build+7 ', ' opaque / Build+7 '],
    [undefined, null],
    [null, null],
    ['', null],
    ['   ', null],
    [' NULL ', null],
    ['undefined', null],
    ['NaN', null],
    [NaN, null],
    [Infinity, null],
    [-Infinity, null],
    [true, null],
    [{}, null],
    [[], null],
  ])('normalizes raw legacy release %p without field errors', async (release, expected) => {
    findOne.mockResolvedValue({ release });
    const { data, errors } = await graphql({
      schema,
      source: metadataSource,
      rootValue: {
        event: {
          projectId,
          payload: { release },
          resolvedInRelease: release,
          regressionInRelease: release,
        },
      },
      contextValue: context,
    });

    expect(errors).toBeUndefined();
    expect(data?.event).toEqual({
      firstSeenInRelease: expected,
      resolvedInRelease: expected,
      regressionInRelease: expected,
      isNew: expected !== null,
    });
    expect(findOne).toHaveBeenCalledTimes(expected === null ? 0 : 1);
  });

  it.each([{}, { projectId }, { projectId, payload: null }, { payload: { release: latestName } }])(
    'returns false without querying for missing project or payload: %p', async (event) => {
      const { data, errors } = await graphql({
        schema,
        source: metadataSource,
        rootValue: { event },
        contextValue: context,
      });

      expect(errors).toBeUndefined();
      expect(data?.event).toMatchObject({ isNew: false });
      expect(findOne).not.toHaveBeenCalled();
    }
  );

  it('returns stored lifecycle release names unchanged', async () => {
    const event = {
      projectId,
      payload: { release: latestName },
      resolvedInRelease: 'hotfix / opaque+name',
      regressionInRelease: 'canary build:abc',
    };
    const { data, errors } = await graphql({
      schema,
      source,
      rootValue: { event },
      contextValue: context,
    });

    expect(errors).toBeUndefined();
    expect(data?.event).toEqual({
      firstSeenInRelease: event.payload.release,
      resolvedInRelease: event.resolvedInRelease,
      regressionInRelease: event.regressionInRelease,
      isNew: true,
      payload: event.payload,
    });
  });

  it('queries once for 50 GraphQL rows and reads afresh in the next request', async () => {
    const events = Array.from({ length: 50 }, (_, index) => ({
      projectId,
      firstSeenInRelease: index % 2 ? latestName : 'older',
      payload: { release: 'selected repetition' },
    }));
    const query = { schema, source: '{ events { isNew } }', rootValue: { events } };
    const first = await graphql({ ...query, contextValue: context });

    expect(first.errors).toBeUndefined();
    expect(first.data?.events).toEqual(events.map((_, index) => ({ isNew: Boolean(index % 2) })));
    expect(findOne).toHaveBeenCalledTimes(1);

    findOne.mockResolvedValue({ release: 'registered with no occurrences' });
    const second = await graphql({
      ...query,
      contextValue: { factories: { releasesFactory: new ReleasesFactory(db) } },
    });

    expect(second.errors).toBeUndefined();
    expect(second.data?.events).toEqual(events.map(() => ({ isNew: false })));
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('uses each event project, not the parent context project', async () => {
    findOne.mockImplementation(({ projectId: id }) => Promise.resolve({ release: id === projectId ? latestName : 'other' }));
    const { data, errors } = await graphql({
      schema,
      source: '{ events { isNew } }',
      rootValue: { events: [projectId, 'another-project'].map(id => ({ projectId: id, payload: { release: latestName } })) },
      contextValue: { ...context, projectId: 'wrong-parent-project' },
    });

    expect(errors).toBeUndefined();
    expect(data?.events).toEqual([{ isNew: true }, { isNew: false }]);
    expect(findOne.mock.calls.map(([filter]) => filter)).toEqual([{ projectId }, { projectId: 'another-project' }]);
  });
});
