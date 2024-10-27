const express = require('express');
const passport = require('passport');

/**
 * Authentication routes
 */
const AUTH_ROUTES = {
  GITHUB_REDIR: '/auth/github',
  GITHUB_CALLBACK: '/auth/github/callback',
};

const authRouter = express.Router();

authRouter.use(passport.initialize());

authRouter.get(
  AUTH_ROUTES.GITHUB_REDIR,
  passport.authenticate('github', { scope: [ 'read:user' ] })
);

authRouter.get(
  AUTH_ROUTES.GITHUB_CALLBACK,
  passport.authenticate('github', {
    session: false,
    failureRedirect: '/login',
  }),
  async (req, res) => {
    // res.json(await req.user.generateTokensPair());
    const { accessToken, refreshToken } = await req.user.generateTokensPair();

    res.redirect(
      `${process.env.GARAGE_LOGIN_URL}?access_token=${accessToken}&refresh_token=${refreshToken}`
    );
  }
);

module.exports = {
  AUTH_ROUTES,
  authRouter,
};
