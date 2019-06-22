const fs = require('fs');

const tabs = fs.readdirSync(__dirname)
  .filter(name => name.endsWith('.graphql'))
  .map(fileName => {
    return {
      endpoint: `http://localhost:${process.env.PORT}/graphql`,
      query: fs.readFileSync(`${__dirname}/${fileName}`).toString()
    };
  });

module.exports = {
  tabs
};
