import type { FastifyPluginAsync, FastifyReply } from 'fastify';
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
  setCookie: Type.Optional(Type.Boolean()),
});

const TokensPair = Type.Object({
  accessToken: Type.String(),
  refreshToken: Type.String(),
});

const RefreshTokensPayload = Type.Object({
  refreshToken: Type.Optional(Type.String()),
});

export type SignupPayloadType = Static<typeof SignupPayload>;
export type SignupReplyType = Static<typeof SignupReply>;

export type LoginPayloadType = Static<typeof LoginPayload>;
export type TokensPairType = Static<typeof TokensPair>;

export type RefreshTokensPayloadType = Static<typeof RefreshTokensPayload>;

/**
 * Sets cookie with access and refresh tokens
 *
 * @param reply - fastify reply
 * @param tokens - tokens pair to set
 */
function setAuthCookies(reply: FastifyReply, tokens: TokensPairType): void {
  reply.setCookie('accessToken', tokens.accessToken, {
    httpOnly: true,
    path: '/',
    sameSite: 'strict',
  });
  reply.setCookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    path: '/refresh-tokens',
    sameSite: 'strict',
  });
}

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

      const tokens = await user.generateTokensPair();

      if (request.query.setCookie) {
        setAuthCookies(reply, tokens);
        reply.status(HttpStatusCodes.SuccessOK);
      } else {
        reply.status(HttpStatusCodes.SuccessOK).send(tokens);
      }
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

      const cookieRefreshToken = request.cookies['refreshToken'];

      const refreshToken = request.query.refreshToken || cookieRefreshToken;

      if (!refreshToken) {
        throw new Error('Auth token is not provided');
      }

      try {
        const data = await verifyRefreshToken(refreshToken);

        userId = data.userId;
      } catch (err) {
        throw new Error('Invalid refresh token');
      }

      const user = await UserModel.findById(userId);

      if (!user) {
        throw new Error('There is no users with that id');
      }

      const tokens = await user.generateTokensPair();

      if (cookieRefreshToken) {
        setAuthCookies(reply, tokens);
        reply.status(HttpStatusCodes.SuccessOK);
      } else {
        reply.status(HttpStatusCodes.SuccessOK).send(tokens);
      }
    });
};

export default authRoutes;
