const express = require('express');
const passport = require('passport');
const User = require('./models/user');

/**
 * Authentication routes
 */
const AUTH_ROUTES = {
  GITHUB_REDIR: '/auth/github',
  GITHUB_CALLBACK: '/auth/github/callback'
};

const authRouter = express.Router();

authRouter.use(passport.initialize());

authRouter.get(AUTH_ROUTES.GITHUB_REDIR, passport.authenticate('github'));

authRouter.get(
  AUTH_ROUTES.GITHUB_CALLBACK,
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    const user = new User({ id: req.user.id });

    res.json(user.generateTokensPair());
  }
);

module.exports = { AUTH_ROUTES, authRouter };
