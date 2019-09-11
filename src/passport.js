const passport = require('passport');
const { Strategy: GitHubStrategy } = require('passport-github');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { AUTH_ROUTES, ACTIONS, COOKIE_KEYS } = require('./auth');
const User = require('./models/user');

/**
 * Email object returned in PassportJS' callback (profile.emails)
 * @typedef {object} PassportEmail
 * @property {boolean} verified - is email verified
 * @property {string} value - email address
 */

/**
 * Find verified email address in PassportJS' strategy callback `profile.emails` argument
 * @param {PassportEmail[]} emails
 */
const findVerifiedEmail = (emails) => {
  for (const el of emails) {
    if (el.verified) {
      return el.value;
    }
  }
  return null;
};

/**
 * Handles user authentication. To be used as PassportJS' strategy callback function.
 *
 * @example
 *passport.use(
 *  new GitHubStrategy({
 *       clientID: process.env.GITHUB_CLIENT_ID,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET,
 *       scope: [ 'user:email' ],
 *       callbackURL:
 *         (process.env.API_URL || 'http://127.0.0.1:4000') +
 *         AUTH_ROUTES.GITHUB_CALLBACK,
 *       passReqToCallback: true
 *     },
 *     handleAuthentication('github', (profile, email) => ({
 *       github: {
 *         id: profile.id,
 *         name: profile.displayName,
 *         image: profile._json.avatar_url,
 *         username: profile.username,
 *         email
 *       }
 *     })
 *   )
 *  )
 *);
 *
 * @param {string} provider - PassportJS supported and *activated* provider, e.g. `github`
 * @param {Function<GithubProvider|GoogleProvider>} profileMapper - function that maps `profile` argument to database storage format.
 * @param {passport.Profile} profileMapper.profile - PassportJS' strategy callback `profile` argument
 * @param {string} profileMapper.email - verified email from `profile.emails`
 * @returns {Function}
 */
const handleAuthentication = (provider, profileMapper) => {
  return async (req, accessToken, refreshToken, profile, cb) => {
    try {
      if (req.session[COOKIE_KEYS.ACTION]) {
        switch (req.session[COOKIE_KEYS.ACTION]) {
          /**
           * Link account.
           * - find verified email
           * - update User
           */
          case ACTIONS.LINK: {
            /**
             * Check authorized user from session
             */
            if (!req.session.user || !req.session.user.id) {
              return cb(new Error('Valid user ID is not provided'), null);
            }

            /**
             * Set action to LINK, so route can unset cookies and redirect to settings
             */
            req.session[COOKIE_KEYS.ACTION] = ACTIONS.LINK;

            const email = findVerifiedEmail(profile.emails);

            const targetUser = await User.findOne({ [provider]: { id: profile.id } });

            /**
             * Check if user from social is already linked with some account,
             * throw an error if it is
             */
            if (targetUser && targetUser.id !== req.session.user.id) {
              return cb(new Error('Provider account is already linked'), null);
            }

            if (!email) {
              return cb(new Error('Verified email is required'), null);
            }

            await User.updateOneById(req.session.user.id, profileMapper(profile, email));

            return cb(null, {});
          }
        }
        /**
         * No custom action => just login user
         */
      } else {
        /**
         * Set action to indicate that we login user
         */
        req.session[COOKIE_KEYS.ACTION] = ACTIONS.LOGIN;

        let user = await User.findOne({ [provider]: { id: profile.id } });

        /**
         * If social account is linked, login the user
         */
        if (user) {
          return cb(null, user);
        }

        const email = findVerifiedEmail(profile.emails);

        if (!email) {
          return cb(new Error('Verified email is required'), null);
        }

        user = await User.create(profileMapper(profile, email), { generatePassword: false });

        return cb(null, user);
      }
    } catch (err) {
      return cb(err, null);
    }
  };
};

/**
 * Initialize passport.js authentication strategies
 */
const initializeStrategies = () => {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        scope: [ 'user:email' ],
        callbackURL:
          (process.env.API_URL || 'http://127.0.0.1:4000') +
          AUTH_ROUTES.GITHUB_CALLBACK,
        passReqToCallback: true,
        pkce: true,
        state: true
      },
      handleAuthentication('github', (profile, email) => ({
        github: {
          id: profile.id,
          name: profile.displayName,
          image: profile._json.avatar_url,
          username: profile.username,
          email
        }
      }))
    )
  );

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        scope: ['profile', 'email'],
        callbackURL:
          (process.env.API_URL || 'http://127.0.0.1:4000') +
          AUTH_ROUTES.GOOGLE_CALLBACK,
        passReqToCallback: true,
        pkce: true,
        state: true
      },
      handleAuthentication('google', (profile, email) => ({
        google: {
          id: profile.id,
          name: profile.displayName,
          image: profile._json.picture,
          email
        }
      }))
    )
  );
};

module.exports = { initializeStrategies };
