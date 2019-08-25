const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { Strategy: GitHubStrategy } = require('passport-github');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { AUTH_ROUTES } = require('./auth');
const User = require('./models/user');

/**
 * Initialize passport.js authentication strategies
 */
const initializeStrategies = () => {
  passport.use(
    new JwtStrategy(
      {
        secretOrKey: process.env.JWT_SECRET,
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
      },
      (payload, done) => {
        return done(null, payload.userId);
      }
    )
  );

  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL:
          (process.env.API_URL || 'http://127.0.0.1:4000') +
          AUTH_ROUTES.GITHUB_CALLBACK
      },
      async (accessToken, refreshToken, profile, cb) => {
        try {
          let user = await User.findOne({ githubId: profile.id });

          if (user) {
            return cb(null, user);
          }

          user = await User.createByGithub({
            id: profile.id,
            name: profile.displayName,
            picture: profile.photos[0].value
          });

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
        callbackURL:
          (process.env.API_URL || 'http://127.0.0.1:4000') +
          AUTH_ROUTES.GOOGLE_CALLBACK
      },
      async (accessToken, refreshToken, profile, cb) => {
        try {
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            return cb(null, user);
          }

          user = await User.createByGoogle({
            id: profile.id,
            name: profile.displayName,
            picture: profile.photos[0].value
          });

          return cb(null, user);
        } catch (err) {
          return cb(err, null);
        }
      }
    )
  );
};

module.exports = { initializeStrategies };
