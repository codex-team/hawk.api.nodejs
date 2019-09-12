const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('./models/user');

/**
 * Authentication routes
 */
const AUTH_ROUTES = {
  ROOT: '/auth',
  INIT: '/auth/init',
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
 * Session keys.
 * Used in routes to take values from session.
 */
const SESSION_KEYS = {
  TOKEN: 'token',
  ACTION: 'action',
  USERID: 'userid'
};

/**
 * Auth actions.
 * Used in routes to switch on different actions.
 */
const ACTIONS = {
  LOGIN: 'login',
  LINK: 'link',
  UNLINK: 'unlink'
};

/**
 *
 * Middleware that requires valid JWT token to be set in `Authorization` header. Extracts user ID from token to request
 */
const requireBearer = async (req, res, next) => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !/^Bearer [a-z0-9-_+/=]+\.[a-z0-9-_+/=]+\.[a-z0-9-_+/=]+$/i.test(authorizationHeader)) {
    return next(new Error('Valid authorization token must be set'));
  }

  const accessToken = authorizationHeader.slice(7);

  try {
    const data = await jwt.verify(accessToken, process.env.JWT_SECRET);

    req.user = { id: data.userId };
    return next();
  } catch (err) {
    return next(new Error('Valid authorization token must be set'));
  }
};

/**
 * Middleware that requires req.session.[SESSION_KEYS.USERID] to be set
 */
const requireSessionUserID = async (req, res, next) => {
  if (!req.session[SESSION_KEYS.USERID]) {
    return next(new Error('user.id is not set'));
  }
  return next();
};

/**
 * Middleware generator to set session action
 * @param {string} action - action from `ACTIONS`
 * @returns {function(req, res, next): <void>} - middleware
 */
const setAction = (action) => {
  return (req, res, next) => {
    req.session[SESSION_KEYS.ACTION] = action;
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
   * Route to redirect to provider OAuth page
   */
  router.get(routeRedir, passport.authenticate(provider));

  /**
   * Callback route for provider to get OAuth code and do custom logic (login or link)
   */
  router.get(routeCallback, passport.authenticate(provider, {
    session: false
  }),
  async (req, res) => {
    /**
     * req.session[SESSION_KEYS.USERID] - authenticated user ID from session(cookie)
     * req.user - authenticated User instance from `handleAuthentication`, got from social login
     */

    /**
     * Check if action is set
     */
    if (!req.session[SESSION_KEYS.ACTION]) {
      return res.redirect(process.env.GARAGE_LOGIN_URL);
    }

    switch (req.session[SESSION_KEYS.ACTION]) {
      /**
       * Link account to existing user
       */
      case ACTIONS.LINK: {
        /**
         * All logic was done in PassportJS strategy, just clear cookies here and redirect to settings page.
         * @see{./passport.js}
         */
        /*
         * res.clearCookie(COOKIE_KEYS.TOKEN);
         * res.clearCookie(COOKIE_KEYS.ACTION);
         */
        req.session.destroy();
        res.redirect(process.env.GARAGE_SETTINGS_URL);
        break;
      }
      case ACTIONS.LOGIN: {
        /**
         * Sign up logic was done in PassportJS strategy. Just issue tokens here and redirect to login page.
         * Then garage sets tokens in query params.
         * @see{./passport.js}
         */
        req.session.destroy();

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
   * - require user ID to be set in session
   * - set `LINK` action in session
   * - redirect to OAuth page
   */
  authRouter.get(routeLink, requireSessionUserID, setAction(ACTIONS.LINK), passport.authenticate(provider));

  /**
   * Account unlinking route
   *
   * Middlewares:
   * - require user ID to be set in session
   * - unlink account
   */
  authRouter.get(routeUnlink, requireSessionUserID, async (req, res) => {
    const user = await User.findById(req.session[SESSION_KEYS.USERID]);

    if (!user || !user.email) {
      return res.redirect(`${process.env.GARAGE_SETTINGS_URL}?error=${encodeURI('Verified email required')}`);
    }

    await User.unsetOneById(user.id, { [provider]: '' });

    req.session.destroy();
    res.redirect(process.env.GARAGE_SETTINGS_URL);
  });
};

const authRouter = express.Router();

/**
 * Set CORS policy to allow sending credentials
 */
authRouter.use(cors({
  credentials: true,
  origin: process.env.NODE_ENV === 'production' ? process.env.GARAGE_ORIGIN : (origin, callback) => {
    /**
     * Allow request if directly hit by user, e.g. redirect
     */
    if (!origin) {
      return callback(null, true);
    }
    if (['http://127.0.0.1:8080', 'http://localhost:8080'].indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

authRouter.use(session({
  secret: process.env.AUTH_SECRET,
  saveUninitialized: false,
  resave: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 5 * 60 * 1000, // 5m
    sameSite: 'lax'
  }
}));

authRouter.use(passport.initialize());

authRouter.get(AUTH_ROUTES.INIT, requireBearer, (req, res) => {
  req.session[SESSION_KEYS.USERID] = req.user.id;
  res.status(200).send('OK');
});

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

module.exports = { AUTH_ROUTES, authRouter, ACTIONS, SESSION_KEYS };
