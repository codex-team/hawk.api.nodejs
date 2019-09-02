const passport = require('passport');
const { Strategy: GitHubStrategy } = require('passport-github');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { AUTH_ROUTES } = require('./auth');
const User = require('./models/user');

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
          AUTH_ROUTES.GITHUB_CALLBACK
      },
      async (accessToken, refreshToken, profile, cb) => {
        try {
          let user = await User.findOne({ github: { id: profile.id } });

          if (user) {
            return cb(null, user);
          }

          let email;

          for (const el of profile.emails) {
            if (el.verified) {
              email = el.value;
              break;
            }
          }

          if (!email) {
            return cb(new Error('Verified email is required'), null);
          }

          user = await User.create({
            github: {
              id: profile.id,
              name: profile.displayName,
              image: profile._json.avatar_url,
              email
            }
          }, { generatePassword: false });

          return cb(null, user);
        } catch (err) {
          return cb(err, null);
        }
      }
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
          AUTH_ROUTES.GOOGLE_CALLBACK
      },
      async (accessToken, refreshToken, profile, cb) => {
        try {
          let user = await User.findOne({ google: { id: profile.id } });

          if (user) {
            return cb(null, user);
          }

          let email;

          for (const el of profile.emails) {
            if (el.verified) {
              email = el.value;
              break;
            }
          }

          if (!email) {
            return cb(new Error('Verified email is required'), null);
          }

          user = await User.create({
            google: {
              id: profile.id,
              name: profile.displayName,
              picture: profile._json.picture,
              email
            }
          }, { generatePassword: false });

          return cb(null, user);
        } catch (err) {
          return cb(err, null);
        }
      }
    )
  );
};

module.exports = { initializeStrategies };
