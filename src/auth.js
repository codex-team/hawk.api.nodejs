const express = require('express');
const passport = require('passport');

/**
 * Authentication routes
 */
const AUTH_ROUTES = {
  GITHUB_REDIR: '/auth/github',
  GITHUB_CALLBACK: '/auth/github/callback',
  GOOGLE_REDIR: '/auth/google',
  GOOGLE_CALLBACK: '/auth/google/callback'
};

const authRouter = express.Router();

authRouter.use(passport.initialize());

// GitHub provider

authRouter.get(
  AUTH_ROUTES.GITHUB_REDIR,
  passport.authenticate('github', { scope: [ 'read:user' ] })
);

authRouter.get(
  AUTH_ROUTES.GITHUB_CALLBACK,
  passport.authenticate('github', {
    session: false,
    failureRedirect: process.env.GARAGE_LOGIN_URL
  }),
  async (req, res) => {
    const { accessToken, refreshToken } = await req.user.generateTokensPair();

    res.redirect(
      `${process.env.GARAGE_LOGIN_URL}?access_token=${accessToken}&refresh_token=${refreshToken}`
    );
  }
);

// Google provider

authRouter.get(
  AUTH_ROUTES.GOOGLE_REDIR,
  passport.authenticate('google', { scope: [ 'profile' ] })
);

authRouter.get(
  AUTH_ROUTES.GOOGLE_CALLBACK,
  passport.authenticate('google', {
    session: false,
    failureRedirect: process.env.GARAGE_LOGIN_URL
  }),
  async (req, res) => {
    const { accessToken, refreshToken } = await req.user.generateTokensPair();

    res.redirect(
      `${process.env.GARAGE_LOGIN_URL}?access_token=${accessToken}&refresh_token=${refreshToken}`
    );
  }
);

module.exports = { AUTH_ROUTES, authRouter };
