const { verify } = require('jsonwebtoken');

const checkUserMiddleware = async (req, res, next) => {
  let accessToken = req.headers['authorization'];

  if (!accessToken) {
    return next();
  }

  if (accessToken.startsWith('Bearer ')) {
    accessToken = accessToken.slice(7);
  }

  try {
    const data = verify(accessToken, process.env.JWT_SECRET);

    req.userId = data.userId;
  } catch {}
  next();
};

module.exports = {
  checkUserMiddleware
};
