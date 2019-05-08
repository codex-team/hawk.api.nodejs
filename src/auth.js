import { verify } from 'jsonwebtoken';

export const checkUserMiddleware = (req, res, next) => {
  let accessToken = req.headers['authorization'];

  if (!accessToken) {
    return next();
  }

  if (accessToken.startsWith('Bearer ')) {
    accessToken = accessToken.slice(7);
  }

  try {
    const data = verify(accessToken, process.env['JWT_SECRET']);

    req.userId = data.userId;
  } catch {}
  next();
};
