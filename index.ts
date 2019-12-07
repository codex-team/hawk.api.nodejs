import './src/env';
import HawkAPI from './src';

const app = new HawkAPI();

app.start()
  .catch(err => {
    console.log('Server runtime error' + err);
  });
