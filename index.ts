import './src/env';
import HawkAPI from './src';
import HawkCatcher from '@hawk.so/nodejs';

/** Enable HawkCatcher */
if (process.env.HAWK_CATCHER_TOKEN) {
  HawkCatcher.init(process.env.HAWK_CATCHER_TOKEN);
}

const app = new HawkAPI();

app.start()
  .catch(err => {
    HawkCatcher.send(err);
    console.log('Server runtime error' + err);
  });
