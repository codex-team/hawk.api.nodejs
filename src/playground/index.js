const fs = require('fs');

const settings = {
  'general.betaUpdates': false,
  'prettier.useTabs': true,
  'schema.disableComments': false,
  'editor.reuseHeaders': true
};

const headers = {
  'authorization': 'Bearer <access token>'
};

const variables = {
  email: 'my@email.com',
  password: '<generated password>',
  accessToken: '<access token>'
};
const stringifiedVars = JSON.stringify(variables, null, 2);

const tabs = fs.readdirSync(__dirname)
  .filter(name => name.endsWith('.graphql'))
  .map(fileName => {
    return {
      name: fileName.slice(0, -8),
      endpoint: `http://localhost:${process.env.PORT}/graphql`,
      query: fs.readFileSync(`${__dirname}/${fileName}`).toString(),
      variables: stringifiedVars,
      headers
    };
  });

module.exports = {
  settings,
  tabs
};
