const { resolve } = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: resolve(__dirname, '../.env') });

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
