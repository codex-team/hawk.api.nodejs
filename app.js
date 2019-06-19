require('./src/env');
const { HawkAPI } = require('./src');

const start = async () => {
  const app = new HawkAPI();

  try {
    await app.start();
  } catch (err) {
    console.log('Server runtime error' + err);
  }
};

start();
