const express = require('express');
const cors = require('cors');
const passport = require('passport');
const jwt = require('jsonwebtoken');

/**
 * Authentication routes
 */
const AUTH_ROUTES = {
  GITHUB_REDIR: '/auth/github',
  GITHUB_CALLBACK: '/auth/github/callback',
  GITHUB_LINK: '/auth/github/link',
  GITHUB_UNLINK: '/auth/github/unlink',
  GOOGLE_REDIR: '/auth/google',
  GOOGLE_CALLBACK: '/auth/google/callback',
  GOOGLE_LINK: '/auth/google/link',
  GOOGLE_UNLINK: '/auth/google/unlink'
};

/**
 * Cookie keys
 */
const COOKIE_KEYS = {
  TOKEN: 'token',
  ACTION: 'action'
};

/**
 * Auth actions
 */
const ACTIONS = {
  LOGIN: 'login',
  LINK: 'link',
  UNLINK: 'unlink'
};

/**
 * Middleware to require user logged in = valid JWT token in query param `access_token`
 */
const requireJWT = async (req, res, next) => {
  if (!req.query.access_token) {
    return next(new Error('A valid JWT token must be provided'));
  }

  try {
    const accessToken = req.query.access_token;
    const data = await jwt.verify(accessToken, process.env.JWT_SECRET);

    req.user = { id: data.userId };
    return next();
  } catch (err) {
    return next(new Error('A valid JWT token must be provided'));
  }
};

/**
 * Middleware to set token from query
 */
const setTokenToCookie = async (req, res, next) => {
  res.cookie(COOKIE_KEYS.TOKEN, req.query.access_token, { httpOnly: true });
  return next();
};

/**
 * Middleware to set cookie action to `link`
 */
const setActionLink = async (req, res, next) => {
  res.cookie(COOKIE_KEYS.ACTION, ACTIONS.LINK, { httpOnly: true });
  return next();
};

const readTokenFromCookies = async (req, res, next) => {
  if (!req.cookies || !req.cookies.token) {
    return next();
  }

  try {
    const accessToken = req.cookies.token;
    const data = await jwt.verify(accessToken, process.env.JWT_SECRET);

    req.user = { id: data.userId };
    return next();
  } catch (err) {
    return next();
  }
};

/**
 * Middleware generator to set cookie action
 * @param {ACTIONS} - action
 * @returns {function(req, res, next): <void>} - middleware
 */
const setAction = (action) => {
  return (req, res, next) => {
    res.cookie(COOKIE_KEYS.ACTION, action, { httpOnly: true });
    return next();
  };
};

const authRouter = express.Router();

authRouter.use(cors());

authRouter.use(passport.initialize());

// GitHub provider

authRouter.get(
  AUTH_ROUTES.GITHUB_REDIR,
  passport.authenticate('github')
);

authRouter.get(
  AUTH_ROUTES.GITHUB_CALLBACK,
  readTokenFromCookies,
  passport.authenticate('github', {
    session: false
  }),
  async (req, res) => {
    console.log(req);

    if (!req.action) {
      return res.redirect(process.env.GARAGE_LOGIN_URL);
    }

    switch (req.action) {
      case ACTIONS.LINK: {
        res.clearCookie('token');
        res.clearCookie('action');
        res.redirect(process.env.GARAGE_SETTINGS_URL);
        break;
      }
      case ACTIONS.LOGIN: {
        const { accessToken, refreshToken } = await req.user.generateTokensPair();

        res.redirect(
          `${process.env.GARAGE_LOGIN_URL}?access_token=${accessToken}&refresh_token=${refreshToken}`
        );
        break;
      }
    }
  }
);

authRouter.get(AUTH_ROUTES.GITHUB_LINK, requireJWT, setTokenToCookie, setActionLink, passport.authenticate('github'));

// Google provider

authRouter.get(
  AUTH_ROUTES.GOOGLE_REDIR,
  passport.authenticate('google')
);

authRouter.get(
  AUTH_ROUTES.GOOGLE_CALLBACK,
  readTokenFromCookies,
  passport.authenticate('google', {
    session: false
  }),
  async (req, res) => {
    // console.log(req);

    if (!req.action) {
      return res.redirect(process.env.GARAGE_LOGIN_URL);
    }

    switch (req.action) {
      case ACTIONS.LINK: {
        res.clearCookie('token');
        res.clearCookie('action');
        res.redirect(process.env.GARAGE_SETTINGS_URL);
        break;
      }
      case ACTIONS.LOGIN: {
        const { accessToken, refreshToken } = await req.user.generateTokensPair();

        res.redirect(
          `${process.env.GARAGE_LOGIN_URL}?access_token=${accessToken}&refresh_token=${refreshToken}`
        );
        break;
      }
    }
  }
);

authRouter.get(AUTH_ROUTES.GOOGLE_LINK, requireJWT, setTokenToCookie, setActionLink, passport.authenticate('google'));

module.exports = { AUTH_ROUTES, authRouter, ACTIONS };
