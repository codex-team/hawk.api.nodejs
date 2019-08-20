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

authRouter.get(AUTH_ROUTES.GITHUB_REDIR, passport.authenticate('github'));

authRouter.get(
  AUTH_ROUTES.GITHUB_CALLBACK,
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    res.json(User.generateTokensPair.call({ id: req.user.id }));
  }
);

module.exports = { AUTH_ROUTES, authRouter };
