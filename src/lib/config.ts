import * as process from 'process';

export const JWT_SECRET_ACCESS_TOKEN = 'JWT_SECRET_ACCESS_TOKEN';
export const JWT_SECRET_REFRESH_TOKEN = 'JWT_SECRET_REFRESH_TOKEN';
export const MONGODB_ACCOUNTS_URI = process.env['MONGODB_ACCOUNTS_URI'] || 'mongodb://localhost:27017/hawk';
