import type { FastifyPluginAsync } from 'fastify';
import UserModel from '../models/user.js';
import { Static, Type } from '@sinclair/typebox';
import HttpStatusCodes from '../lib/http-status-codes.js';
import { verifyRefreshToken } from '../lib/auth-tokens.js';

const SignupPayload = Type.Object({
  email: Type.String({ format: 'email' }),
});

const SignupReply = Type.Object({
  success: Type.Boolean(),
  password: Type.String(),
});

const LoginPayload = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String(),
});

const TokensPair = Type.Object({
  accessToken: Type.String(),
  refreshToken: Type.String(),
});

const RefreshTokensPayload = Type.Object({
  refreshToken: Type.String(),
});

export type SignupPayloadType = Static<typeof SignupPayload>;
export type SignupReplyType = Static<typeof SignupReply>;

export type LoginPayloadType = Static<typeof LoginPayload>;
export type TokensPairType = Static<typeof TokensPair>;

export type RefreshTokensPayloadType = Static<typeof RefreshTokensPayload>;

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{Body: SignupPayloadType, Reply: SignupReplyType}>(
    '/signup',
    {
      schema:{
        body: SignupPayload,
        response:{
          [HttpStatusCodes.SuccessCreated]: SignupReply,
        },
      },
    },
    async (request, reply) => {
      const [, password] = await UserModel.createByEmail(request.body.email);

      reply.status(HttpStatusCodes.SuccessCreated).send({
        success: true,
        password,
      });
    });


  fastify.get<{Querystring: LoginPayloadType, Reply: TokensPairType}>(
    '/login',
    {
      schema: {
        querystring: LoginPayload,
        response: {
          [HttpStatusCodes.SuccessOK]: TokensPair,
        },
      },
    },
    async (request, reply) => {
      const user = await UserModel.findByEmail(request.query.email);

      if (!user || !(await user.comparePassword(request.query.password))) {
        throw new Error('Wrong email or password');
      }

      reply.status(HttpStatusCodes.SuccessOK).send(await user.generateTokensPair());
    });

  fastify.get<{Querystring: RefreshTokensPayloadType, Reply: TokensPairType}>(
    '/refresh-tokens',
    {
      schema: {
        querystring: RefreshTokensPayload,
        response: {
          [HttpStatusCodes.SuccessOK]: TokensPair,
        },
      },
    },
    async (request, reply) => {
      let userId;

      try {
        const data = await verifyRefreshToken(request.query.refreshToken);

        userId = data.userId;
      } catch (err) {
        throw new Error('Invalid refresh token');
      }

      const user = await UserModel.findById(userId);

      if (!user) {
        throw new Error('There is no users with that id');
      }

      reply.status(HttpStatusCodes.SuccessOK).send(await user.generateTokensPair());
    });
};

export default authRoutes;
