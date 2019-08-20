const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { Strategy: GitHubStrategy } = require('passport-github');

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
          process.env.API_URL + '/auth/github/callback' ||
          'http://127.0.0.1:4000/auth/github/callback'
      },
      (accessToken, refreshToken, profile, cb) => {
        /**
         * @todo: check user in database, create if not exists
         */
      }
    )
  );
};

module.exports = { initializeStrategies };
