const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { Strategy: GitHubStrategy } = require('passport-github');
const { AUTH_ROUTES } = require('./auth');

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
      (accessToken, refreshToken, profile, cb) => {
        /**
         * @todo: check user in database, create if not exists
         *  return user id
         */
        console.log({ accessToken, refreshToken, profile });
        cb(null, profile);
      }
    )
  );
};

module.exports = { initializeStrategies };
