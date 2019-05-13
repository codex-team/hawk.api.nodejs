const { resolve } = require('path');
const dotenv = require('dotenv');

module.exports = dotenv.config({ path: resolve(__dirname, '../.env') }).parsed;
