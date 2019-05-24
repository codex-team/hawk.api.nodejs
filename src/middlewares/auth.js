const { verify } = require('jsonwebtoken');

/**
 * Check authorization header and verify user
 * @param {Request} req - Express request
 * @param {Response} res - Express request
 * @param {function} next - next middleware
 */
async function checkUserMiddleware(req, res, next) {
  let accessToken = req.headers['authorization'];

  if (!accessToken) {
    return next();
  }

  if (accessToken.startsWith('Bearer ')) {
    accessToken = accessToken.slice(7);
  }

  try {
    const data = await verify(accessToken, process.env.JWT_SECRET);

    req.locals.userId = data.userId;
  } catch (err) {
  }
  next();
}

module.exports = {
  checkUserMiddleware
};
