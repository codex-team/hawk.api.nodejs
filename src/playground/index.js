const fs = require('fs');

const headers = {
  'authorization': 'Bearer <access token>'
};

const variables = {
  accessToken: 'lol'
};

const tabs = fs.readdirSync(__dirname)
  .filter(name => name.endsWith('.graphql'))
  .map(fileName => {
    return {
      name: fileName.slice(0, -8),
      endpoint: `http://localhost:${process.env.PORT}/graphql`,
      query: fs.readFileSync(`${__dirname}/${fileName}`).toString(),
      variables: JSON.stringify(variables),
      headers
    };
  });

module.exports = {
  tabs
};
