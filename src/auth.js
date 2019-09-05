const express = require('express');
const cors = require('cors');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('./models/user');

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
 * @param {string} action - action from `ACTIONS`
 * @returns {function(req, res, next): <void>} - middleware
 */
const setAction = (action) => {
  return (req, res, next) => {
    res.cookie(COOKIE_KEYS.ACTION, action, { httpOnly: true });
    return next();
  };
};

/**
 * Setup authentication routes
 *
 * @param {express.Router} router - authorization router(separate router or express app)
 * @param {string} provider - PassportJS supported and *activated* provider, e.g. `github`
 * @param {string} routeRedir - route for redirect
 * @param {string} routeCallback - route for callback
 * @param {string} routeLink - route for account linking
 * @param {string} routeUnlink - route for account unlinking
 */
const setupAuthRoutes = (router, {
  provider,
  routeRedir,
  routeCallback,
  routeLink,
  routeUnlink
}) => {
  /**
   * Redirect to provider OAuth page
   */
  router.get(routeRedir, passport.authenticate(provider));

  /**
   * Callback route for provider to get OAuth code and do custom logic (login or link)
   */
  router.get(routeCallback, readTokenFromCookies, passport.authenticate(provider, {
    session: false
  }),
  async (req, res) => {
    /**
     * Check if action is set
     */
    if (!req.action) {
      return res.redirect(process.env.GARAGE_LOGIN_URL);
    }

    switch (req.action) {
      /**
       * Link account to existing user
       */
      case ACTIONS.LINK: {
        /**
         * All logic was done in PassportJS strategy, just clear cookies here and redirect to settings page.
         * @see{./passport.js}
         */
        res.clearCookie(COOKIE_KEYS.TOKEN);
        res.clearCookie(COOKIE_KEYS.ACTION);
        res.redirect(process.env.GARAGE_SETTINGS_URL);
        break;
      }
      case ACTIONS.LOGIN: {
        /**
         * Sign up logic was done in PassportJS strategy. Just issue tokens here and redirect to login page.
         * Then garage sets tokens in query params.
         * @see{./passport.js}
         */
        const { accessToken, refreshToken } = await req.user.generateTokensPair();

        res.redirect(
          `${process.env.GARAGE_LOGIN_URL}?access_token=${accessToken}&refresh_token=${refreshToken}`
        );
        break;
      }
    }
  });

  /**
   * Account linking route
   *
   * Middlewares:
   * - require JWT access token in query
   * - set token to Cookie, so we can get it in callback and identify user
   * - set action `link` in Cookie
   * - redirect to OAuth page
   */
  authRouter.get(routeLink, requireJWT, setTokenToCookie, setAction(ACTIONS.LINK), passport.authenticate(provider));

  /**
   * Account unlinking route
   *
   * Middlewares:
   * - require JWT access token in query
   * - unlink account
   */
  authRouter.get(routeUnlink, requireJWT, async (req, res) => {
    if (!req.user || !req.user.id) {
      throw new Error('User is not provided');
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.redirect(process.env.GARAGE_SETTINGS_URL);
    }

    await User.unsetOneById(user.id, { [provider]: '' });

    res.redirect(process.env.GARAGE_SETTINGS_URL);
  });
};

const authRouter = express.Router();

authRouter.use(cors());

authRouter.use(passport.initialize());

setupAuthRoutes(authRouter, {
  provider: 'github',
  routeRedir: AUTH_ROUTES.GITHUB_REDIR,
  routeCallback: AUTH_ROUTES.GITHUB_CALLBACK,
  routeLink: AUTH_ROUTES.GITHUB_LINK,
  routeUnlink: AUTH_ROUTES.GITHUB_UNLINK
});

setupAuthRoutes(authRouter, {
  provider: 'google',
  routeRedir: AUTH_ROUTES.GOOGLE_REDIR,
  routeCallback: AUTH_ROUTES.GOOGLE_CALLBACK,
  routeLink: AUTH_ROUTES.GOOGLE_LINK,
  routeUnlink: AUTH_ROUTES.GOOGLE_UNLINK
});

module.exports = { AUTH_ROUTES, authRouter, ACTIONS };
