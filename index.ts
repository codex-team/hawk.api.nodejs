import './src/env';
import HawkAPI from './src';
import HawkCatcher from '@hawk.so/nodejs';
import { version } from './package.json';

/** Enable HawkCatcher */
if (process.env.HAWK_CATCHER_TOKEN) {
  HawkCatcher.init({
    token: process.env.HAWK_CATCHER_TOKEN,
    release: version,
  });
}

const app = new HawkAPI();

app.start()
  .catch(err => {
    HawkCatcher.send(err);
    console.log('Server runtime error' + err);
  });
