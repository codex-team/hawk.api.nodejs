/**
 * Developer console
 * Load like this: `node -r ./devconsole.js`
 *
 * Loads all mongoose models from `./src/db/models`
 */
const hawkDBConnection = require('./src/db/connection');
const fs = require('fs');
const path = require('path');

const importModels = () => {
  global.mongoose = require('mongoose');

  fs.readdirSync(path.join(__dirname, 'src/db/models'))
    .filter(name => name.endsWith('.js'))
    .forEach(file => {
      const model = require(path.resolve(__dirname, 'src/db/models', file));

      global[model.modelName] = model;
    });
};

hawkDBConnection
  .createConnections(
    process.env.MONGO_URL_API || 'mongodb://localhost:27017/hawk',
    process.env.MONGO_URL_EVENTS || 'mongodb://localhost:27017/events'
  )
  .then(importModels);
