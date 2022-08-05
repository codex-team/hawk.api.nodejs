/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ApolloServerBase,
  convertNodeHttpToRequest,
  GraphQLOptions,
  isHttpQueryError,
  runHttpQuery
} from 'apollo-server-core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import accepts from '@fastify/accepts';
import fastifyCors from '@fastify/cors';
import HttpStatusCode from '../lib/http-status-codes.js';

export interface ServerRegistration {
    path?: string;
    cors?: Record<string, unknown> | boolean;
    onHealthCheck?: (req: FastifyRequest) => Promise<any>;
    disableHealthCheck?: boolean;
}

export interface FastifyContext {
    request: FastifyRequest;
    reply: FastifyReply;
}

type FastifyHandler = (app: FastifyInstance) => void;

/**
 * ApolloServer subclass that uses fastify as its underlying HTTP server.
 */
export class ApolloServer<
    ContextFunctionParams = FastifyContext,
    > extends ApolloServerBase<ContextFunctionParams> {
  /**
   * Creates request handler for Fastify
   *
   * @param options - handler options
   */
  public createHandler({
    path,
    cors,
    disableHealthCheck,
    onHealthCheck,
  }: ServerRegistration = {}): FastifyHandler {
    this.graphqlPath = path || '/graphql';

    this.assertStarted('createHandler');

    const landingPage = this.getLandingPage();

    return async (app: FastifyInstance) => {
      if (!disableHealthCheck) {
        app.get('/.well-known/apollo/server-health', async (request, reply) => {
          // Response follows https://tools.ietf.org/html/draft-inadarei-api-health-check-01
          reply.type('application/health+json');

          if (onHealthCheck) {
            try {
              await onHealthCheck(request);
              reply.send('{"status":"pass"}');
            } catch (e) {
              reply.status(HttpStatusCode.ServerErrorServiceUnavailable).send('{"status":"fail"}');
            }
          } else {
            reply.send('{"status":"pass"}');
          }
        });
      }

      app.register(
        async (instance) => {
          instance.register(accepts);
          if (cors === true) {
            instance.register(fastifyCors);
          } else if (cors !== false) {
            instance.register(fastifyCors, cors);
          }

          instance.setNotFoundHandler((_request, reply) => {
            reply.code(HttpStatusCode.ClientErrorMethodNotAllowed);
            reply.header('allow', 'GET, POST');
            reply.send();
          });

          const preHandler = landingPage
            ? async (request: FastifyRequest, reply: FastifyReply) => {
              if (request.raw.method === 'GET') {
                const accept = request.accepts();
                const types = accept.types() as string[];
                const prefersHtml =
                        types.find(
                          (x: string) =>
                            x === 'text/html' || x === 'application/json'
                        ) === 'text/html';

                if (prefersHtml) {
                  reply.type('text/html');
                  reply.send(landingPage.html);
                }
              }
            }
            : () => { /* noop */ };

          instance.route({
            method: ['GET', 'POST'],
            url: '/',
            preHandler,
            handler: async (request, reply) => {
              try {
                const { graphqlResponse, responseInit } = await runHttpQuery(
                  [],
                  {
                    method: request.raw.method as string,
                    options: () =>
                      this.createGraphQLServerOptions(request, reply),
                    query: (request.raw.method === 'POST'
                      ? request.body
                      : request.query) as any,
                    request: convertNodeHttpToRequest(request.raw),
                  },
                  this.csrfPreventionRequestHeaders
                );

                if (responseInit.headers) {
                  for (const [name, value] of Object.entries<string>(
                    responseInit.headers
                  )) {
                    reply.header(name, value);
                  }
                }
                reply.status(responseInit.status || HttpStatusCode.SuccessOK);
                reply.serializer((payload: string) => payload);
                reply.send(graphqlResponse);
              } catch (error) {
                if (!isHttpQueryError(error)) {
                  throw error;
                }

                if (error.headers) {
                  for (const [header, value] of Object.entries(error.headers)) {
                    reply.header(header, value);
                  }
                }

                reply.code(error.statusCode);
                reply.serializer((payload: string) => payload);
                reply.send(error.message);
              }
            },
          });
        },
        {
          prefix: this.graphqlPath,
        }
      );
    };
  }


  /**
   * Returns options from GraphQL server
   *
   * @param request - Fastify request
   * @param reply - Fastify reply
   */
  private async createGraphQLServerOptions(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<GraphQLOptions> {
    const contextParams: FastifyContext = {
      request,
      reply,
    };

    return this.graphQLServerOptions(contextParams);
  }
}
